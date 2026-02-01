import type { PhysicsEngineTickContext } from './engineTickTypes';
import { runTickPreflight } from './engineTickPreflight';
import { createDebugStats } from './stats';
import { getNowMs } from './engineTime';
import { updateHudSnapshot } from './engineTickHud';
import { finalizePhysicsTick } from './engineTickFinalize';
import { integrateNodes } from './integration';
import { createMotionPolicy } from './motionPolicy';
import { applyDragVelocity } from './velocity/dragVelocity';

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
    const isStartup = preflight.isStartup;

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
        false
    );

    // 3. Solver (TODO)
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
