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

    // Run 6: Compliance from Config
    const compliance = engine.config.xpbdLinkCompliance ?? 0.0001;

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
            compliance: compliance, // Use Config
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

// Mini Run 5: Reconcile Ghost Velocity
const reconcileAfterXPBDConstraints = (
    engine: PhysicsEngineTickContext,
    preSolveSnapshot: Float32Array,
    nodeList: any[],
    dt: number
) => {
    // Tuning (DEV_TUNING)
    const GHOST_VEL_THRESHOLD_PX_PER_SEC = 100.0; // 100px/s implies significant kick

    let ghostVelMax = 0;
    let ghostVelEvents = 0;
    let prevSyncAppliedNodes = 0;

    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];

        if (node.isFixed) continue;

        const oldX = preSolveSnapshot[i * 2 + 0];
        const oldY = preSolveSnapshot[i * 2 + 1];

        const dx = node.x - oldX;
        const dy = node.y - oldY;

        // Optimization: Zero check
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) continue;

        // Apply Delta to History (Verlet Consistency)
        if (node.prevX !== undefined) node.prevX += dx;
        if (node.prevY !== undefined) node.prevY += dy;
        prevSyncAppliedNodes++;

        // Telemetry
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ghostVel = dist / dt;

        if (ghostVel > ghostVelMax) ghostVelMax = ghostVel;
        if (ghostVel > GHOST_VEL_THRESHOLD_PX_PER_SEC) ghostVelEvents++;
    }

    // Update Accumulators
    if (engine.xpbdFrameAccum) {
        engine.xpbdFrameAccum.springs.prevAdjusted = prevSyncAppliedNodes;
        engine.xpbdFrameAccum.springs.ghostVelMax = ghostVelMax;
        engine.xpbdFrameAccum.springs.ghostVelEvents = ghostVelEvents;
    }
};

// Mini Run 4: XPBD Solver V1
const solveXPBDEdgeConstraints = (engine: PhysicsEngineTickContext, dt: number) => {
    const start = performance.now();
    const EPSILON = 1e-6;

    // Run 6: Calibration & Safety
    const MAX_CORR_PX = engine.config.xpbdMaxCorrPerConstraintPx ?? 100.0;
    const USE_CANARY = engine.config.debugXPBDCanary;

    let solvedCount = 0;
    let skippedCount = 0;
    let singularityCount = 0;

    let errSum = 0;
    let corrMax = 0;
    let corrSum = 0;
    let iter = 1;

    // Calibration Canary (Run 6)
    // If enabled, artificially shorten the first constraint to force visual error.
    if (USE_CANARY && engine.xpbdConstraints.length > 0) {
        const c = engine.xpbdConstraints[0];
        // Hack: temporarily modify dist/restLen perspective to force error
        // Actually, just changing restLen on the fly is safer/simpler for a canary check
        // We'll set effectiveRestLen inside the loop if it's the target.
    }

    const constraints = engine.xpbdConstraints;
    const nodes = engine.nodes;

    // Solver Loop (Single Iteration)
    for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const nA = nodes.get(c.nodeA);
        const nB = nodes.get(c.nodeB);

        if (!nA || !nB) {
            skippedCount++;
            continue;
        }

        // 1. Calculate Error (C)
        const dx = nA.x - nB.x;
        const dy = nA.y - nB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < EPSILON) {
            singularityCount++;
            continue;
        }

        // Canary Injection: For constraint 0, subtract 50px from restLen effectively
        // This makes `dist` look 50px too long (extension) or restLen too short.
        let effectiveRestLen = c.restLen;
        if (USE_CANARY && i === 0) {
            effectiveRestLen = Math.max(10, c.restLen - 50); // Shrink rest length -> Pull together
        }

        const C = dist - effectiveRestLen;

        errSum += Math.abs(C);

        // 2. Gradients
        const gradX = dx / dist;
        const gradY = dy / dist;

        // 3. Inverse Masses
        const wA = (nA.isFixed || nA.id === engine.draggedNodeId) ? 0 : 1.0;
        const wB = (nB.isFixed || nB.id === engine.draggedNodeId) ? 0 : 1.0;

        if (wA + wB === 0) {
            skippedCount++;
            continue;
        }

        // 4. Alpha (Compliance)
        const alpha = c.compliance / (dt * dt);

        // 5. Delta Lambda
        const denom = wA + wB + alpha;
        const deltaLambda = (-C - alpha * c.lambda) / denom;

        c.lambda += deltaLambda;

        // 6. Apply Correction
        let pxA = -wA * deltaLambda * gradX;
        let pyA = -wA * deltaLambda * gradY;
        let pxB = +wB * deltaLambda * gradX;
        let pyB = +wB * deltaLambda * gradY;

        // Safety Cap (Run 6)
        // Check magnitude of correction vectors
        const magA = Math.sqrt(pxA * pxA + pyA * pyA);
        const magB = Math.sqrt(pxB * pxB + pyB * pyB);

        if (magA > MAX_CORR_PX) {
            const scale = MAX_CORR_PX / magA;
            pxA *= scale;
            pyA *= scale;
        }
        if (magB > MAX_CORR_PX) {
            const scale = MAX_CORR_PX / magB;
            pxB *= scale;
            pyB *= scale;
        }

        nA.x += pxA;
        nA.y += pyA;
        nB.x += pxB;
        nB.y += pyB;

        // Telemetry
        corrMax = Math.max(corrMax, magA, magB);
        corrSum += magA + magB;

        solvedCount++;
    }

    const duration = performance.now() - start;

    if (engine.xpbdFrameAccum) {
        engine.xpbdFrameAccum.edgeConstraintsExecuted++;
        const s = engine.xpbdFrameAccum.springs;

        s.count = constraints.length;
        s.iter += iter;
        s.solveMs += duration;
        s.errSum += errSum;
        s.corrSum += corrSum;
        s.corrMax = Math.max(s.corrMax, corrMax);
        s.skipped += skippedCount;
        s.singularity += singularityCount;
    }
};

export const runPhysicsTickXPBD = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // 1. Setup & Preflight
    const nodeList = engine.getNodeList();
    const preflight = runTickPreflight(engine, nodeList);

    if (engine.xpbdConstraintsDirty) {
        rebuildXPBDConstraints(engine);
    }

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
        engine.xpbdFrameAccum.springs.ghostVelMax = 0;
        engine.xpbdFrameAccum.springs.ghostVelEvents = 0;
    }

    const policyResult = engine.timePolicy.evaluate(dtIn * 1000);
    const dt = policyResult.dtUseSec;
    const dtRawMs = dtIn * 1000;

    const debugStats = createDebugStats();
    debugStats.hubFlipCount = preflight.frameHubFlips;
    debugStats.hubNodeCount = preflight.frameHubNodeCount;
    (debugStats as any).mode = 'XPBD';

    const motionPolicy = createMotionPolicy(1.0, 0, 0, false);

    if (!engine.config.debugDisableAllVMods) {
        applyDragVelocity(engine as any, nodeList, dt, debugStats);
    }

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
        true
    );

    // 3. Solver
    const nodeCount = nodeList.length;
    const preSolveSnapshot = new Float32Array(nodeCount * 2);
    for (let i = 0; i < nodeCount; i++) {
        preSolveSnapshot[i * 2 + 0] = nodeList[i].x;
        preSolveSnapshot[i * 2 + 1] = nodeList[i].y;
    }

    solveXPBDEdgeConstraints(engine, dt);

    // 4. Reconcile
    reconcileAfterXPBDConstraints(engine, preSolveSnapshot, nodeList, dt);

    if (debugStats && debugStats.xpbd) {
        const accum = engine.xpbdFrameAccum;
        accum.ticks++;
        accum.dtSum += dt;
    }

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

    updateHudSnapshot(engine, getNowMs(), dtRawMs, nodeList, debugStats, 1, 'moving');
};
