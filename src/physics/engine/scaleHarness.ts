import { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';

type HarnessMetrics = {
    nodeCount: number;
    settleMs: number;
    overshootMax: number;
    jitterAvg: number;
    pbdCorrectionAvg: number;
    correctionOpposePct: number;
    energyProxy: number;
    budgetScaleHistogram: number[];
};

const HARNESS_FLAG = '__PHYSICS_SCALE_HARNESS__';

const createRng = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0xffffffff;
    };
};

const buildDeterministicGraph = (engine: PhysicsEngine, nodeCount: number, seed: number) => {
    const rng = createRng(seed);
    const baseRadius = engine.config.targetSpacing * engine.config.initScale * 2;
    const nodeRadius = Math.max(4, engine.config.minNodeDistance * 0.15);

    for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2;
        const jitter = (rng() - 0.5) * nodeRadius * 0.2;
        const r = baseRadius + jitter;
        const node: PhysicsNode = {
            id: `h${nodeCount}-${i}`,
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            vx: 0,
            vy: 0,
            fx: 0,
            fy: 0,
            mass: 1,
            radius: nodeRadius,
            isFixed: false,
        };
        engine.addNode(node);
    }

    // Ring links for deterministic topology
    const ids = Array.from(engine.nodes.keys()).sort();
    for (let i = 0; i < ids.length; i++) {
        const source = ids[i];
        const target = ids[(i + 1) % ids.length];
        engine.addLink({ source, target, length: engine.config.linkRestLength });
    }

    // Extra links for density parity across counts (seeded)
    const extraLinks = Math.floor(nodeCount * 0.5);
    for (let i = 0; i < extraLinks; i++) {
        const a = Math.floor(rng() * ids.length);
        const b = Math.floor(rng() * ids.length);
        if (a === b) continue;
        const source = ids[Math.min(a, b)];
        const target = ids[Math.max(a, b)];
        engine.addLink({ source, target, length: engine.config.linkRestLength });
    }
};

const collectOpposingCorrectionRatio = (engine: PhysicsEngine) => {
    let opposing = 0;
    let total = 0;
    for (const node of engine.getNodeList()) {
        if (!node.lastCorrectionDir) continue;
        const speed = Math.hypot(node.vx, node.vy);
        if (speed < 0.01) continue;
        const dot = node.vx * node.lastCorrectionDir.x + node.vy * node.lastCorrectionDir.y;
        total += 1;
        if (dot < 0) opposing += 1;
    }
    return total > 0 ? opposing / total : 0;
};

const runScenario = (nodeCount: number): HarnessMetrics => {
    const engine = new PhysicsEngine({ debugPerf: false });
    buildDeterministicGraph(engine, nodeCount, 1337);

    const dt = 1 / 60;
    const totalFrames = 480;
    const dragStart = 120;
    const dragEnd = 180;
    const releaseFrame = dragEnd + 1;
    const dragNodeId = `h${nodeCount}-0`;

    let settleFrame: number | null = null;
    let stableFrames = 0;
    let overshootMax = 0;
    let pbdCorrectionSum = 0;
    let opposeSum = 0;
    let opposeFrames = 0;
    let energyProxy = 0;
    let energyFrames = 0;
    const budgetBins = [0, 0, 0, 0];

    for (let frame = 0; frame < totalFrames; frame++) {
        if (frame === dragStart) {
            const node = engine.nodes.get(dragNodeId);
            if (node) {
                engine.grabNode(dragNodeId, { x: node.x, y: node.y });
            }
        }
        if (frame >= dragStart && frame <= dragEnd) {
            const t = (frame - dragStart) / Math.max(1, dragEnd - dragStart);
            const angle = t * Math.PI * 2;
            const radius = engine.config.targetSpacing * 0.2;
            engine.moveDrag({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        if (frame === releaseFrame) {
            engine.releaseNode();
        }

        engine.tick(dt);

        const debugStats = engine.getDebugStats();
        const correction = debugStats?.passes?.Corrections?.correction ?? 0;
        pbdCorrectionSum += correction;

        const opposeRatio = collectOpposingCorrectionRatio(engine);
        opposeSum += opposeRatio;
        opposeFrames += 1;

        const budgetScale = engine.unifiedMotionState?.budgetScale ?? 0;
        if (budgetScale < 0.25) budgetBins[0] += 1;
        else if (budgetScale < 0.5) budgetBins[1] += 1;
        else if (budgetScale < 0.75) budgetBins[2] += 1;
        else budgetBins[3] += 1;

        if (frame >= releaseFrame) {
            let maxSpeed = 0;
            for (const node of engine.getNodeList()) {
                maxSpeed = Math.max(maxSpeed, Math.hypot(node.vx, node.vy));
            }
            overshootMax = Math.max(overshootMax, maxSpeed);
        }

        if (engine.getSettleSnapshot().state === 'sleep') {
            stableFrames += 1;
            if (stableFrames >= 30 && settleFrame === null) {
                settleFrame = frame;
            }
        } else {
            stableFrames = 0;
        }

        if (frame > totalFrames - 60) {
            for (const node of engine.getNodeList()) {
                energyProxy += node.vx * node.vx + node.vy * node.vy;
            }
            energyFrames += engine.getNodeList().length;
        }
    }

    return {
        nodeCount,
        settleMs: settleFrame !== null ? settleFrame * dt * 1000 : totalFrames * dt * 1000,
        overshootMax,
        jitterAvg: engine.getSettleSnapshot().jitterAvg,
        pbdCorrectionAvg: pbdCorrectionSum / totalFrames,
        correctionOpposePct: opposeFrames > 0 ? (opposeSum / opposeFrames) * 100 : 0,
        energyProxy: energyFrames > 0 ? energyProxy / energyFrames : 0,
        budgetScaleHistogram: budgetBins,
    };
};

export const maybeRunScaleHarness = (engine: PhysicsEngine) => {
    const flag = (globalThis as any)?.[HARNESS_FLAG];
    if (!flag || engine.scaleHarnessRan) return;
    engine.scaleHarnessRan = true;

    const schedule = typeof setTimeout === 'function' ? setTimeout : (fn: () => void) => fn();
    schedule(() => {
        const sizes = [5, 20, 60, 250, 500];
        const results = sizes.map(runScenario);
        console.log('[ScaleHarness] Results (N=5/20/60/250/500)');
        console.table(results.map(result => ({
            N: result.nodeCount,
            settleMs: result.settleMs.toFixed(0),
            overshootMax: result.overshootMax.toFixed(2),
            jitterAvg: result.jitterAvg.toFixed(4),
            pbdCorrectionAvg: result.pbdCorrectionAvg.toFixed(3),
            corrOpposePct: result.correctionOpposePct.toFixed(1),
            energyProxy: result.energyProxy.toFixed(3),
            budgetBins: result.budgetScaleHistogram.join('/'),
        })));
    }, 0);
};
