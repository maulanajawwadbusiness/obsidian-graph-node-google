import type { PhysicsNode } from '../types';
import { logEnergyDebug } from './debug';
import { getNowMs } from './engineTime';
import type { DebugStats } from './stats';
import type { PhysicsEngineTickContext } from './engineTickTypes';
import { updateHudSnapshot } from './engineTickHud';

export type TickFinalizeInput = {
    engine: PhysicsEngineTickContext;
    nodeList: PhysicsNode[];
    localBoostActive: boolean;
    perfEnabled: boolean;
    debugStats: DebugStats;
    dtRawMs: number;
    energy: number;
    effectiveDamping: number;
    maxVelocityEffective: number;
    frameTiming: {
        repulsionMs: number;
        collisionMs: number;
        springsMs: number;
        spacingMs: number;
        pbdMs: number;
        totalMs: number;
    } | null;
    tickStart: number;
    spacingStride: number;
};

export const finalizePhysicsTick = ({
    engine,
    nodeList,
    localBoostActive,
    perfEnabled,
    debugStats,
    dtRawMs,
    energy,
    effectiveDamping,
    maxVelocityEffective,
    frameTiming,
    tickStart,
    spacingStride,
}: TickFinalizeInput) => {
    for (const node of nodeList) {
        if (node.isFixed || node.id === engine.draggedNodeId) {
            node.sleepFrames = 0;
            node.isSleeping = false;

            const T_Speed = 0.05;
            const T_Force = 0.1;
            const T_Pressure = 0.25;

            let calmCount = 0;
            const outliers: string[] = [];
            const blockers: string[] = [];

            for (const node of nodeList) {
                if (node.isFixed) {
                    calmCount++;
                    continue;
                }

                const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                const force = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
                const press = node.lastCorrectionMag || 0;

                const isCalm = speed < T_Speed && force < T_Force && press < T_Pressure;

                if (isCalm && node.id !== engine.draggedNodeId) {
                    calmCount++;
                    node.sleepFrames = (node.sleepFrames || 0) + 1;

                    if (node.sleepFrames > 120) {
                        // Optional: node.isSleeping = true;
                    }
                } else {
                    node.sleepFrames = 0;
                    if (outliers.length < 3) {
                        outliers.push(node.id);
                    }
                }
            }

            const totalNodes = nodeList.length || 1;
            const calmPercent = (calmCount / totalNodes) * 100;
            const targetConf = calmPercent >= 95 ? 1.0 : 0.0;
            const alpha = 0.05;

            if (typeof engine.settleConfidence === 'undefined') engine.settleConfidence = 0;

            engine.settleConfidence = engine.settleConfidence * (1 - alpha) + targetConf * alpha;

            if (engine.draggedNodeId) {
                engine.settleConfidence = 0;
            }

            if (calmPercent < 95) blockers.push(`Calm ${calmPercent.toFixed(1)}% < 95%`);
            const current = engine.hudSettleState;
            let next = current;
            const conf = engine.settleConfidence;

            if (current === 'moving') {
                if (conf > 0.5) next = 'cooling';
            } else if (current === 'cooling') {
                if (conf > 0.95) next = 'sleep';
                else if (conf < 0.2) next = 'moving';
            } else if (current === 'sleep') {
                if (conf < 0.8) next = 'moving';
            } else {
                next = 'moving';
            }

            if (!engine.stateFlipTracking) {
                engine.stateFlipTracking = { count: 0, lastFlipMs: 0, windowStartMs: getNowMs(), flipHistory: [] };
            }

            if (next !== current) {
                engine.hudSettleState = next;
                engine.hudSettleStateAt = getNowMs();

                const now = getNowMs();
                engine.stateFlipTracking.flipHistory.push(now);
                engine.stateFlipTracking.flipHistory = engine.stateFlipTracking.flipHistory.filter(t => now - t < 10000);
                engine.stateFlipTracking.count = engine.stateFlipTracking.flipHistory.length;
            }

            if (engine.hudSettleState === 'sleep') {
                for (const node of nodeList) {
                    if (!node.isFixed && node.id !== engine.draggedNodeId) {
                        node.vx = 0;
                        node.vy = 0;
                        node.isSleeping = true;
                    }
                }
            } else {
                for (const node of nodeList) node.isSleeping = false;
            }

            if (engine.hudSnapshot) {
                engine.hudSnapshot.settleState = engine.hudSettleState;
                engine.hudSnapshot.lastSettleMs = getNowMs() - engine.hudSettleStateAt;

                engine.hudSnapshot.minSpeedSq = 0;
                engine.hudSnapshot.breakdownSpeed = 0;
                engine.hudSnapshot.breakdownForce = 0;
                engine.hudSnapshot.breakdownPressure = 0;
                engine.hudSnapshot.breakdownJitter = 0;

                engine.hudSnapshot.restCandidates = calmCount;
                engine.hudSnapshot.calmPercent = calmPercent;
                engine.hudSnapshot.outlierCount = totalNodes - calmCount;
                engine.hudSnapshot.settleBlockers = blockers;
            }
        }

        if (engine.draggedNodeId && engine.dragTarget) {
            const node = engine.nodes.get(engine.draggedNodeId);
            if (node) {
                const dx = node.x - engine.dragTarget.x;
                const dy = node.y - engine.dragTarget.y;
                const lag = Math.sqrt(dx * dx + dy * dy);
                engine.dragLagSamples.push(lag);
            }
        }

        if (perfEnabled) {
            const now = getNowMs();
            if (now - engine.handLogAt >= 1000) {
                engine.handLogAt = now;
                let lagP95 = 0;
                if (engine.dragLagSamples.length > 0) {
                    const sorted = engine.dragLagSamples.slice().sort((a, b) => a - b);
                    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
                    lagP95 = sorted[idx] ?? 0;
                }
                console.log(
                    `[Hand] dragging=${engine.draggedNodeId ? 'Y' : 'N'} ` +
                    `localBoost=${localBoostActive ? 'Y' : 'N'} ` +
                    `lagP95Px=${lagP95.toFixed(2)}`
                );
                engine.dragLagSamples.length = 0;
            }
        }

        logEnergyDebug(engine.lifecycle, energy, effectiveDamping, maxVelocityEffective);
        if (engine.frameIndex % 4 === 0) {
            updateHudSnapshot(engine, getNowMs(), dtRawMs, nodeList, debugStats, spacingStride);
        }
        for (const node of nodeList) {
            if (
                Number.isFinite(node.x) &&
                Number.isFinite(node.y) &&
                Number.isFinite(node.vx) &&
                Number.isFinite(node.vy)
            ) {
                node.lastGoodX = node.x;
                node.lastGoodY = node.y;
                node.lastGoodVx = node.vx;
                node.lastGoodVy = node.vy;
            }
        }

        if (perfEnabled && frameTiming) {
            const tickEnd = getNowMs();
            frameTiming.totalMs = tickEnd - tickStart;

            const perf = engine.perfTiming;
            perf.frameCount += 1;
            perf.totals.repulsionMs += frameTiming.repulsionMs;
            perf.totals.collisionMs += frameTiming.collisionMs;
            perf.totals.springsMs += frameTiming.springsMs;
            perf.totals.spacingMs += frameTiming.spacingMs;
            perf.totals.pbdMs += frameTiming.pbdMs;
            perf.totals.totalMs += frameTiming.totalMs;

            if (perf.lastReportAt === 0) {
                perf.lastReportAt = tickEnd;
            }
            const elapsed = tickEnd - perf.lastReportAt;
            if (elapsed >= 1000) {
                const frames = perf.frameCount || 1;
                const avg = (value: number) => (value / frames).toFixed(3);
                console.log(
                    `[PhysicsPerf] avgMs repulsion=${avg(perf.totals.repulsionMs)} ` +
                    `collision=${avg(perf.totals.collisionMs)} ` +
                    `springs=${avg(perf.totals.springsMs)} ` +
                    `spacing=${avg(perf.totals.spacingMs)} ` +
                    `pbd=${avg(perf.totals.pbdMs)} ` +
                    `total=${avg(perf.totals.totalMs)} ` +
                    `nodes=${nodeList.length} ` +
                    `links=${engine.links.length} ` +
                    `mode=${engine.perfMode} ` +
                    `allocs=${engine.perfCounters.nodeListBuilds + engine.perfCounters.correctionNewEntries} ` +
                    `topoDrop=${engine.perfCounters.topologySkipped} ` +
                    `topoDup=${engine.perfCounters.topologyDuplicates} ` +
                    `frames=${frames}`
                );
                perf.frameCount = 0;
                perf.totals.repulsionMs = 0;
                perf.totals.collisionMs = 0;
                perf.totals.springsMs = 0;
                perf.totals.spacingMs = 0;
                perf.totals.pbdMs = 0;
                perf.totals.totalMs = 0;
                perf.lastReportAt = tickEnd;
                engine.perfCounters.nodeListBuilds = 0;
                engine.perfCounters.correctionNewEntries = 0;
                engine.perfCounters.topologySkipped = 0;
                engine.perfCounters.topologyDuplicates = 0;
            }
            engine.perfCounters.topologyDuplicates = 0;
        }
    }
};
