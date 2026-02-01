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

    // Validation Metrics
    let invalidEndpointCount = 0;
    let nonFiniteRestLenCount = 0;
    let zeroLenEdgeCount = 0;

    for (const link of engine.links) {
        const nodeA = engine.nodes.get(link.source);
        const nodeB = engine.nodes.get(link.target);

        if (!nodeA || !nodeB) {
            invalidEndpointCount++;
            continue;
        }

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Policy
        const restLen = Math.max(MIN_REST, Math.min(MAX_REST, dist));

        // Validation Checks
        if (!Number.isFinite(restLen)) {
            nonFiniteRestLenCount++;
            continue;
        }
        if (restLen <= 0) {
            zeroLenEdgeCount++; // Should be caught by MIN_REST policy but double check
            continue;
        }

        newConstraints.push({
            nodeA: link.source,
            nodeB: link.target,
            dist: dist,
            restLen: restLen,
            compliance: 0.1, // XPBD Compliance (px/N) - 0.1 for soft
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
            avgRest: sumRest / count,
            invalidEndpointCount,
            nonFiniteRestLenCount,
            zeroLenEdgeCount
        };
    } else {
        engine.xpbdConstraintStats = {
            minRest: 0, maxRest: 0, avgRest: 0,
            invalidEndpointCount, nonFiniteRestLenCount, zeroLenEdgeCount
        };
    }

    engine.xpbdConstraints = newConstraints;
    engine.xpbdConstraintsDirty = false;
};

// Mini Run 4: XPBD Solver V1
const solveXPBDEdgeConstraints = (engine: PhysicsEngineTickContext, dt: number) => {
    // Manual Timer: Start
    const start = performance.now();

    // Configuration constants (explicit)
    const EPSILON = 1e-6;
    const ADJUST_PREV_ON_SOLVE = true; // Safety: Ghost Velocity Containment

    let solvedCount = 0;
    let skippedCount = 0;
    let singularityCount = 0;
    let prevAdjustedCount = 0;

    // Accumulators for this frame
    let errSum = 0;
    let corrMax = 0;
    let corrSum = 0;
    let iter = 1; // Single iteration for V1

    if (engine.xpbdFrameAccum) {
        // Accumulators persist across ticks if not cleared, but handled by hudReset usually.
    }

    const constraints = engine.xpbdConstraints;
    const nodes = engine.nodes;

    // Solver Loop (Single Iteration)
    for (let c of constraints) {
        const nA = nodes.get(c.nodeA);
        const nB = nodes.get(c.nodeB);

        // Validation / Liveness Check
        if (!nA || !nB) {
            skippedCount++;
            continue;
        }

        // 1. Calculate Error (C)
        const dx = nA.x - nB.x;
        const dy = nA.y - nB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Singularity Check
        if (dist < EPSILON) {
            singularityCount++;
            continue; // V1: Skip to avoid NaN
        }

        const C = dist - c.restLen;

        // Accumulate Error (before correction)
        errSum += Math.abs(C);

        // 2. Gradients
        const gradX = dx / dist;
        const gradY = dy / dist;

        // 3. Inverse Masses
        // Fixed nodes or Dragged nodes have infinite mass (invMass = 0)
        // Checks: isFixed, or isDragged? 
        // engine.draggedNodeId check?
        const wA = (nA.isFixed || nA.id === engine.draggedNodeId) ? 0 : 1.0; // mass=1 for free
        const wB = (nB.isFixed || nB.id === engine.draggedNodeId) ? 0 : 1.0;

        if (wA + wB === 0) {
            skippedCount++; // Both fixed, cannot solve
            continue;
        }

        // 4. Alpha (Compliance)
        // alpha = compliance / dt^2
        const alpha = c.compliance / (dt * dt);

        // 5. Delta Lambda
        const denom = wA + wB + alpha;
        const deltaLambda = (-C - alpha * c.lambda) / denom;

        c.lambda += deltaLambda;

        // 6. Apply Correction
        const pxA = -wA * deltaLambda * gradX;
        const pyA = -wA * deltaLambda * gradY;
        const pxB = +wB * deltaLambda * gradX;
        const pyB = +wB * deltaLambda * gradY;

        nA.x += pxA;
        nA.y += pyA;
        nB.x += pxB;
        nB.y += pyB;

        // 7. Safety: Ghost Velocity Containment
        if (ADJUST_PREV_ON_SOLVE) {
            if (nA.prevX !== undefined) nA.prevX += pxA;
            if (nA.prevY !== undefined) nA.prevY += pyA;
            if (nB.prevX !== undefined) nB.prevX += pxB;
            if (nB.prevY !== undefined) nB.prevY += pyB;
            prevAdjustedCount += (wA > 0 ? 1 : 0) + (wB > 0 ? 1 : 0);
        }

        // Telemetry
        const mag = Math.abs(deltaLambda); // Approximation of correction magnitude? 
        // Actual displacement magnitude is |pxA| + |pxB|? 
        const magA = Math.sqrt(pxA * pxA + pyA * pyA);
        const magB = Math.sqrt(pxB * pxB + pyB * pyB);
        corrMax = Math.max(corrMax, magA, magB);
        corrSum += magA + magB; // Total displacement

        solvedCount++;
    }

    // Manual Timer: End
    const duration = performance.now() - start;

    // Update Telemetry
    if (engine.xpbdFrameAccum) {
        engine.xpbdFrameAccum.edgeConstraintsExecuted++;
        const s = engine.xpbdFrameAccum.springs;

        // TRUTHFUL UPDATES
        s.count = constraints.length;
        s.iter += iter; // 1 iteration
        s.solveMs += duration;

        s.errSum += errSum;
        s.corrSum += corrSum;
        s.corrMax = Math.max(s.corrMax, corrMax);

        s.skipped += skippedCount;
        s.singularity += singularityCount;
        s.prevAdjusted += prevAdjustedCount;
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

    // TELEMETRY: Reset Per-Frame Accumulators
    if (engine.xpbdFrameAccum) {
        engine.xpbdFrameAccum.edgeConstraintsExecuted = 0;
        engine.xpbdFrameAccum.springs.count = 0;
        engine.xpbdFrameAccum.springs.iter = 0;
        engine.xpbdFrameAccum.springs.solveMs = 0;
        engine.xpbdFrameAccum.springs.errSum = 0;
        engine.xpbdFrameAccum.springs.corrSum = 0;
        engine.xpbdFrameAccum.springs.corrMax = 0;
        engine.xpbdFrameAccum.springs.skipped = 0;
        engine.xpbdFrameAccum.springs.singularity = 0;
        engine.xpbdFrameAccum.springs.prevAdjusted = 0;
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
    solveXPBDEdgeConstraints(engine, dt);

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
