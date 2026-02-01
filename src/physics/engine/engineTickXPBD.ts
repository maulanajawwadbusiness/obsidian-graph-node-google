import type { PhysicsEngineTickContext } from './engineTickTypes';
import { runTickPreflight } from './engineTickPreflight';
import { createDebugStats } from './stats';
import { getNowMs } from './engineTime';
import { updateHudSnapshot } from './engineTickHud';
import { finalizePhysicsTick } from './engineTickFinalize';
import { integrateNodes } from './integration';
import { createMotionPolicy } from './motionPolicy';
import { applyDragVelocity } from './velocity/dragVelocity';

// Mini Run 3: XPBD Inventory & Policy
const rebuildXPBDConstraints = (engine: PhysicsEngineTickContext) => {
    // Policy: clamp(currentDistanceAtSpawn, minRest, maxRest)
    // This ensures "Spawn is Neutral" for initial stability.
    const MIN_REST = 10;
    const MAX_REST = 1000;

    const newConstraints: any[] = [];

    for (const link of engine.links) {
        const nodeA = engine.nodes.get(link.source);
        const nodeB = engine.nodes.get(link.target);
        if (!nodeA || !nodeB) continue;

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const restLen = Math.max(MIN_REST, Math.min(MAX_REST, dist));

        newConstraints.push({
            nodeA: link.source,
            nodeB: link.target,
            dist: dist,
            restLen: restLen,
            compliance: 0.0, // Infinite stiffness for now (alpha = 0)
            lambda: 0.0
        });
    }

    // Compute Stats
    let minRest = 999999;
    let maxRest = 0;
    let sumRest = 0;
    const count = newConstraints.length;

    if (count > 0) {
        for (const c of newConstraints) {
            if (c.restLen < minRest) minRest = c.restLen;
            if (c.restLen > maxRest) maxRest = c.restLen;
            sumRest += c.restLen;
        }
        engine.xpbdConstraintStats = {
            minRest,
            maxRest,
            avgRest: sumRest / count
        };
    } else {
        engine.xpbdConstraintStats = { minRest: 0, maxRest: 0, avgRest: 0 };
    }

    engine.xpbdConstraints = newConstraints;
    engine.xpbdConstraintsDirty = false;
};

// Mini Run 1: Stub for Edge Constraints
const applyXPBDEdgeConstraintsStub = (engine: PhysicsEngineTickContext) => {
    // Manual Timer: Start (TODO: Wrap real solver work later)
    const start = performance.now();

    // No-op for physics.
    // Telemetry proof of life.

    // Manual Timer: End
    const duration = performance.now() - start;

    if (engine.xpbdFrameAccum) {
        engine.xpbdFrameAccum.edgeConstraintsExecuted++;

        // Proof-of-Life Telemetry 0 - REAL INVENTORY
        const s = engine.xpbdFrameAccum.springs;
        s.count = engine.xpbdConstraints.length; // Live count from INVENTORY
        s.iter += 0;                   // Placeholder for solver iterations (reset)
        s.solveMs += duration;         // Accumulate time
        s.errSum += 0;                 // Placeholder for error accumulation
        s.corrSum += 0;                // Placeholder for correction accumulation
        // s.corrMax = Math.max(s.corrMax, 0); // No-op
    }
};

/**
 * XPBD Core Pipeline (Knife-Sharp Isolation)
 * 
 * Strict Sequence:
 * 1. Preflight (Firewall)
 * 2. Prediction (Integrate V -> P*) - Drag applied here or via VMod
 * 3. Solver (Constraints - x, v updates)
 * 4. Velocity Update (v = (x - prevX) / dt)
 * 5. Finalize
 */
export const runPhysicsTickXPBD = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // 1. Setup & Preflight
    const nodeList = engine.getNodeList();
    const preflight = runTickPreflight(engine, nodeList);

    // Inventory Maintenance
    if (engine.xpbdConstraintsDirty) {
        rebuildXPBDConstraints(engine);
    }

    // XPBD prefers Fixed DT, but we respect the policy
    const policyResult = engine.timePolicy.evaluate(dtIn * 1000);
    const dt = policyResult.dtUseSec;
    const dtRawMs = dtIn * 1000;

    // Stats
    const debugStats = createDebugStats();
    debugStats.hubFlipCount = preflight.frameHubFlips;
    debugStats.hubNodeCount = preflight.frameHubNodeCount;
    // Inject Mode into stats (hack for now, ideally stats has mode field)
    (debugStats as any).mode = 'XPBD';

    // 2. Integration (Prediction Phase)
    // We use the existing integrateNodes for now, but stripped of V-Mods
    // Create a dummy motion policy
    const motionPolicy = createMotionPolicy(1.0, 0, 0, false);

    // Apply Drag (Air Resistance) - Allowed V-Mod
    if (!engine.config.debugDisableAllVMods) {
        applyDragVelocity(engine as any, nodeList, dt, debugStats);
    }

    // Integrate: x* = x + v * dt
    // Note: integrateNodes currently does Euler. XPBD wants: v += f/m * dt; x += v * dt based on PREVIOUS v? 
    // Actually Semi-Implicit Euler matches XPBD prediction step.
    integrateNodes(
        engine as any,
        nodeList,
        dt,
        1.0,
        motionPolicy,
        engine.config.damping,
        engine.config.maxVelocity,
        debugStats,
        false,
        true // useXPBD
    );

    // 3. Solver
    applyXPBDEdgeConstraintsStub(engine);
    // solveXPBDConstraints(engine, dt);

    // 4. Velocity Rebuild (TODO: Implement in next task)
    // For now, we leave the integrated velocity alone (semi-implicit behavior)

    // XPBD Frame Accumulation (Proof of Life)
    if (debugStats && debugStats.xpbd) {
        const accum = engine.xpbdFrameAccum;
        accum.ticks++;
        accum.dtSum += dt;
        // Logic will go here
    }

    // 5. Finalize
    finalizePhysicsTick({
        engine,
        nodeList,
        localBoostActive: false,
        perfEnabled: false,
        debugStats,
        dtRawMs,
        energy: 1.0,
        effectiveDamping: engine.config.damping,
        maxVelocityEffective: engine.config.maxVelocity,
        frameTiming: null,
        tickStart: getNowMs(),
        spacingStride: 1,
    });

    // Populate HUD
    // Mark as "XPBD" mode in settlement state to be visible?
    updateHudSnapshot(engine, getNowMs(), dtRawMs, nodeList, debugStats, 1, 'moving');
};
