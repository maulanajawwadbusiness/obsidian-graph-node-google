import type { PhysicsEngineTickContext } from './engineTickTypes';
import type { PhysicsNode } from '../types';  // Mini Run 3: For active/sleeping split
import { runTickPreflight } from './engineTickPreflight';
import { createDebugStats } from './stats';
import { getNowMs } from './engineTime';
import { updateHudSnapshot } from './engineTickHud';
import { finalizePhysicsTick } from './engineTickFinalize';
import { integrateNodes } from './integration';
import { createMotionPolicy } from './motionPolicy';
import { applyDragVelocity } from './velocity/dragVelocity';
import { applyRepulsion } from '../forces';  // Mini Run 3: Force-based repulsion

// =============================================================================
// STEP 3/5: XPBD-SPECIFIC DAMPING DEFAULT
// =============================================================================
// XPBD mode uses its own damping default, separate from legacy config.damping.
//
// Damping formula: v *= exp(-effectiveDamping * 5.0 * dt)
// Half-life formula: t_half = ln(2) / (effectiveDamping * 5.0)
//
// Target half-life: ~0.6-1.0 seconds (responsive but not too loose)
//
// Calculation for half-life = 0.7s:
//   0.7 = 0.693 / (effectiveDamping * 5.0)
//   effectiveDamping * 5.0 = 0.693 / 0.7 = 0.99
//   effectiveDamping = 0.99 / 5.0 = 0.198 ≈ 0.20
//
// Chosen value: 0.20 (half-life ≈ 0.69s)
// =============================================================================
export const DEFAULT_XPBD_DAMPING = 0.20;

// STEP 4/5 RUN 2: Telemetry state for change detection and rate limiting
let lastTelemetrySource: 'DEFAULT' | 'CONFIG' | 'CLAMPED' | null = null;
let lastTelemetryEffective: number | null = null;
let lastTelemetryTime = 0;

// Mini Run 7: Kinematic Drag Lock
const applyKinematicDrag = (engine: PhysicsEngineTickContext, dt: number) => {
    // If we have a dragged node and a target, Force Position (Pin)
    if (engine.draggedNodeId && engine.dragTarget) {
        const node = engine.nodes.get(engine.draggedNodeId);
        if (node) {
            const oldX = node.x;
            const oldY = node.y;

            // Run 7: Telemetry - Drag Lag (Pre-Snap)
            const lagX = node.x - engine.dragTarget.x;
            const lagY = node.y - engine.dragTarget.y;
            const lagDist = Math.sqrt(lagX * lagX + lagY * lagY);
            if (engine.xpbdFrameAccum) {
                engine.xpbdFrameAccum.springs.dragLagMax = Math.max(engine.xpbdFrameAccum.springs.dragLagMax || 0, lagDist);
            }

            // FIX: Maximum Drag Distance Clamp
            // Prevent graph topology from stretching too far
            // Store initial grab position in grabOffset (repurposed)
            if (!engine.grabOffset) {
                // First frame of drag - store initial position
                engine.grabOffset = { x: node.x, y: node.y };
            }

            // FIX: Removed MAX_DRAG_DISTANCE Clamp (Run 7.6)
            // Previous: clamped to 300px from initial grab.
            // Now: Unrestricted drag. Cursor wins.

            // Logic removed:
            // const MAX_DRAG_DISTANCE = 300;
            // if (targetDist > MAX_DRAG_DISTANCE) { ... }

            let clampedTargetX = engine.dragTarget.x;
            let clampedTargetY = engine.dragTarget.y;

            // Mini Run 7 Part 1: INSTANT snap for crisp response (no mush)
            // Previous: Gradual lerp caused lag/latency
            // Now: Directly set to clamped target
            node.x = clampedTargetX;
            node.y = clampedTargetY;

            // 2. Kinematic Velocity (Implicit)
            // v = (x - x_old) / dt
            if (dt > 1e-6) {
                node.vx = (node.x - oldX) / dt;
                node.vy = (node.y - oldY) / dt;
            }

            // 3. History Reconciliation (Verlet Consistency)
            // Mini Run 7 Part 1: Keep prevX = oldX for velocity continuity
            // This means (x - prevX) represents the drag motion this frame
            node.prevX = oldX;
            node.prevY = oldY;

            // 4. DO NOT mutate isFixed (Mini Run 7 Part 2 cleanup)
            // Solver checks draggedNodeId directly for invMass=0
            // node.isFixed = true; // ❌ REMOVED - redundant and problematic
        }
    }
};

// Mini Run 3: XPBD Inventory & Policy
const rebuildXPBDConstraints = (engine: PhysicsEngineTickContext) => {
    // Policy: clamp(currentDistanceAtSpawn, minRest, maxRest)
    // This ensures "Spawn is Neutral" for initial stability.
    const MIN_REST = 10;
    const MAX_REST = 1000;

    // Run 6: Compliance from Config
    // CRITICAL: Smaller compliance = STIFFER = larger corrections = EXPLOSION
    // Larger compliance = SOFTER = smaller corrections = STABLE
    // Formula: alpha = compliance / dt²
    //   - Small alpha (stiff) → deltaLambda ≈ -C/wSum (rigid, large correction)
    //   - Large alpha (soft) → deltaLambda ≈ -C/alpha (soft, small correction)
    // 
    // Calibration:
    //   0.0001 → alpha≈0.39 → TOO STIFF → EXPLOSION on drag release
    //   0.01   → alpha≈39   → Visible ~0.2px corrections, stable
    //   0.1    → alpha≈390  → Very soft, barely visible
    const compliance = engine.config.xpbdLinkCompliance ?? 0.001;

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

        // Run 7: Release Ghost Telemetry
        // Check if the released node had a ghost spike (bad reconcile)
        if (engine.lastReleasedNodeId && (engine.frameIndex - engine.lastReleaseFrame <= 1)) {
            // Find the released node
            // Since we loop all nodes, we could have done it above, but let's keep it clean here or peek
            const relNode = engine.nodes.get(engine.lastReleasedNodeId);
            if (relNode && relNode.prevX !== undefined) {
                // Wait, we have nodeList. Let's assume O(N) lookup isn't tragic for 1 node, or just re-calc ghost for it.
                // Actually, we calculated ghostVel for all nodes above. 
                // If the released node caused `ghostVelEvents` to increment, we want to know.
                // But `ghostVelEvents` is global.
                // We want strictly: Did the RELEASED node spike?

                // Re-calculate strictly for the released node
                const idx = nodeList.indexOf(relNode);
                if (idx >= 0) {
                    const ox = preSolveSnapshot[idx * 2 + 0];
                    const oy = preSolveSnapshot[idx * 2 + 1];
                    const rx = relNode.x - ox;
                    const ry = relNode.y - oy;
                    const rDist = Math.sqrt(rx * rx + ry * ry);
                    const rVel = rDist / dt;
                    if (rVel > GHOST_VEL_THRESHOLD_PX_PER_SEC) {
                        engine.xpbdFrameAccum.springs.releaseGhostEvents = 1;
                    }
                }
            }
        }
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

    // Calibration Canary (Run 6)
    if (USE_CANARY && engine.xpbdConstraints.length > 0) {
        // Validation check only
    }

    const constraints = engine.xpbdConstraints;
    const nodes = engine.nodes;

    // Mini Run 7 Part 4: Track pinned nodes
    let pinnedCount = 0;
    const draggedNodePinned = engine.draggedNodeId !== null;
    // Don't count here, count in loop

    let dragConstraintCount = 0;

    // Run 2: Iterations
    const iterIdle = engine.config.xpbdIterationsIdle || 2;
    const iterDrag = engine.config.xpbdIterationsDrag || 6;
    const iterCount = draggedNodePinned ? iterDrag : iterIdle;

    const selectionMode = engine.config.xpbdEdgeSelection || 'full';

    // Run 4: Safety Hard Cap
    const MAX_ITERATIONS_HARD_CAP = 12;
    const safeIterCount = Math.min(iterCount, MAX_ITERATIONS_HARD_CAP);

    // Run 3: Lambda Reset
    for (let k = 0; k < constraints.length; k++) {
        constraints[k].lambda = 0.0;
    }

    let earlyBreak = false;
    let prevIterCorrMax = Number.MAX_VALUE;
    let usedIterations = 0;

    // Solver Loop (Multi-Iteration)
    for (let iter = 0; iter < safeIterCount; iter++) {
        usedIterations++;

        // Reset per-pass counters
        solvedCount = 0;
        skippedCount = 0;
        singularityCount = 0;

        let iterCorrMax = 0;
        let iterAbsCMax = 0; // Run 4: Track Max Error

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const nA = nodes.get(c.nodeA);
            const nB = nodes.get(c.nodeB);

            if (!nA || !nB) {
                skippedCount++;
                continue;
            }

            // Run 2: Filter Logic
            if (selectionMode === 'incident' && engine.draggedNodeId) {
                if (c.nodeA !== engine.draggedNodeId && c.nodeB !== engine.draggedNodeId) {
                    skippedCount++;
                    continue;
                }
            }

            const dx = nA.x - nB.x;
            const dy = nA.y - nB.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < EPSILON) {
                singularityCount++;
                continue;
            }

            let effectiveRestLen = c.restLen;
            if (USE_CANARY && i === 0 && iter === 0) {
                effectiveRestLen = Math.max(10, c.restLen - 50);
            }

            const C = dist - effectiveRestLen;
            const absC = Math.abs(C);

            errSum += absC;
            iterAbsCMax = Math.max(iterAbsCMax, absC);

            const gradX = dx / dist;
            const gradY = dy / dist;

            const wA = (nA.isFixed || nA.id === engine.draggedNodeId) ? 0 : 1.0;
            const wB = (nB.isFixed || nB.id === engine.draggedNodeId) ? 0 : 5.0;

            if (iter === 0) {
                if (wA === 0 && nA.id !== engine.draggedNodeId) pinnedCount++;
                if (wB === 0 && nB.id !== engine.draggedNodeId) pinnedCount++;
                if (nA.id === engine.draggedNodeId || nB.id === engine.draggedNodeId) dragConstraintCount++;
            }

            if (wA + wB === 0) {
                skippedCount++;
                continue;
            }

            const alpha = c.compliance / (dt * dt);
            const denom = wA + wB + alpha;
            const deltaLambda = (-C - alpha * c.lambda) / denom;

            c.lambda += deltaLambda;

            let pxA = +wA * deltaLambda * gradX;
            let pyA = +wA * deltaLambda * gradY;
            let pxB = -wB * deltaLambda * gradX;
            let pyB = -wB * deltaLambda * gradY;

            let magA = Math.sqrt(pxA * pxA + pyA * pyA);
            let magB = Math.sqrt(pxB * pxB + pyB * pyB);

            let capHit = false;
            if (magA > MAX_CORR_PX) {
                const scale = MAX_CORR_PX / magA;
                pxA *= scale; pyA *= scale; magA *= scale; capHit = true;
            }
            if (magB > MAX_CORR_PX) {
                const scale = MAX_CORR_PX / magB;
                pxB *= scale; pyB *= scale; magB *= scale; capHit = true;
            }

            nA.x += pxA; nA.y += pyA;
            nB.x += pxB; nB.y += pyB;

            iterCorrMax = Math.max(iterCorrMax, magA, magB);
            corrMax = Math.max(corrMax, magA, magB);
            corrSum += magA + magB;

            solvedCount++;

            if (i === 0 && iter === 0 && engine.xpbdFrameAccum) {
                engine.xpbdFrameAccum.springs.firstCapHit = capHit;
                engine.xpbdFrameAccum.springs.firstAlpha = alpha;
                engine.xpbdFrameAccum.springs.firstWSum = wA + wB;
                engine.xpbdFrameAccum.springs.firstEdgeDebug = {
                    C, deltaLambda, corrDotA: (pxA * gradX + pyA * gradY), corrDotB: (pxB * gradX + pyB * gradY), gradX, gradY
                };
            }
        }

        // Run 3: Stagnation Guard
        const STAGNATION_THRESHOLD_PX = 0.05;
        if (iterCorrMax < STAGNATION_THRESHOLD_PX) {
            earlyBreak = true;
            if (iter === 0 && engine.xpbdFrameAccum) engine.xpbdFrameAccum.springs.maxAbsCFirst = iterAbsCMax;
            if (engine.xpbdFrameAccum) engine.xpbdFrameAccum.springs.maxAbsC = iterAbsCMax;
            break;
        }

        if (iter === 0 && engine.xpbdFrameAccum) engine.xpbdFrameAccum.springs.maxAbsCFirst = iterAbsCMax;
        if (engine.xpbdFrameAccum) engine.xpbdFrameAccum.springs.maxAbsC = iterAbsCMax;

        prevIterCorrMax = iterCorrMax;
    }

    if (engine.xpbdFrameAccum) {
        const s = engine.xpbdFrameAccum.springs;
        s.count += constraints.length;
        // Run 2: Iterations
        s.iter += usedIterations; // Accumulate used iterations
        s.earlyBreakCount += earlyBreak ? 1 : 0;
        s.solveMs += (performance.now() - start);
        s.errSum += errSum;
        s.corrSum += corrSum;
        s.corrMax = Math.max(s.corrMax, corrMax);
        s.skipped += skippedCount;
        s.singularity += singularityCount;

        // Mini Run 7 Part 4: Drag coupling telemetry
        s.pinnedCount = pinnedCount;
        s.draggedNodePinned = draggedNodePinned;
        s.dragConstraintCount = dragConstraintCount;  // TUG RUN PART 2

        // Run 1: Edge Coverage Telemetry
        s.totalEdgesGraph = engine.links.length;
        s.edgesSelectedForSolve = constraints.length;
        s.edgesSelectedReason = selectionMode;
        s.edgesSkippedByCoverage = 0;
        s.edgesProcessed = solvedCount;
        s.edgesSelectedButUnprocessed = constraints.length - skippedCount - singularityCount - solvedCount;

        // Run 5: Safety Guard
        if (s.edgesSelectedReason === 'full' && s.totalEdgesGraph > 10) {
            const ratio = s.edgesProcessed / s.totalEdgesGraph;
            if (ratio < 0.9) {
                if (Math.random() < 0.01) { // Throttle
                    console.warn(`[XPBD-COVERAGE-LOW] Processed ${s.edgesProcessed}/${s.totalEdgesGraph} (${(ratio * 100).toFixed(1)}%) - Check Pinning/Singularities`);
                }
            }
        }
    }
};

export const runPhysicsTickXPBD = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // 1. Setup & Preflight
    const nodeList = engine.getNodeList();
    const preflight = runTickPreflight(engine, nodeList);

    if (engine.xpbdConstraintsDirty) {
        rebuildXPBDConstraints(engine);
    }

    let firstAId: string | null = null;
    let firstBId: string | null = null;
    let preIntegrateAX = 0;
    let preIntegrateAY = 0;
    let preIntegrateBX = 0;
    let preIntegrateBY = 0;
    let preSolveAX = 0;
    let preSolveAY = 0;
    let preSolveBX = 0;
    let preSolveBY = 0;
    let postSolveAX = 0;
    let postSolveAY = 0;
    let postSolveBX = 0;
    let postSolveBY = 0;

    if (engine.xpbdConstraints.length > 0) {
        const c0 = engine.xpbdConstraints[0];
        const a0 = engine.nodes.get(c0.nodeA);
        const b0 = engine.nodes.get(c0.nodeB);
        if (a0 && b0) {
            firstAId = c0.nodeA;
            firstBId = c0.nodeB;
            preIntegrateAX = a0.x;
            preIntegrateAY = a0.y;
            preIntegrateBX = b0.x;
            preIntegrateBY = b0.y;
        }
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
        engine.xpbdFrameAccum.springs.releaseGhostEvents = 0;
        engine.xpbdFrameAccum.springs.dragLagMax = 0;
        engine.xpbdFrameAccum.springs.pinnedCount = 0;  // Mini Run 7
        engine.xpbdFrameAccum.springs.draggedNodePinned = false;  // Mini Run 7
        engine.xpbdFrameAccum.springs.dragConstraintCount = 0;  // TUG RUN
        engine.xpbdFrameAccum.springs.firstJumpPx = 0;
        engine.xpbdFrameAccum.springs.firstJumpPhase = 'none';
        engine.xpbdFrameAccum.springs.firstJumpNodeId = null;
        engine.xpbdFrameAccum.springs.firstMovePx = 0;
        engine.xpbdFrameAccum.springs.firstMovePhase = 'none';
        engine.xpbdFrameAccum.springs.firstMoveNodeId = null;
        engine.xpbdFrameAccum.springs.firstCapHit = false;
        engine.xpbdFrameAccum.springs.firstAlpha = 0;
        engine.xpbdFrameAccum.springs.firstWSum = 0;
        engine.xpbdFrameAccum.springs.firstPreIntegrateJumpPx = 0;
        engine.xpbdFrameAccum.springs.firstPreIntegrateNodeId = null;
        engine.xpbdFrameAccum.springs.earlyBreakCount = 0;
        engine.xpbdFrameAccum.springs.maxAbsC = 0;
        engine.xpbdFrameAccum.springs.maxAbsCFirst = 0;
    }

    if (engine.xpbdFrameAccum && engine.xpbdFirstPairPrev && firstAId && firstBId) {
        const prev = engine.xpbdFirstPairPrev;
        if (prev.aId === firstAId && prev.bId === firstBId) {
            const jumpAPre = Math.sqrt(
                (preIntegrateAX - prev.ax) * (preIntegrateAX - prev.ax) +
                (preIntegrateAY - prev.ay) * (preIntegrateAY - prev.ay)
            );
            const jumpBPre = Math.sqrt(
                (preIntegrateBX - prev.bx) * (preIntegrateBX - prev.bx) +
                (preIntegrateBY - prev.by) * (preIntegrateBY - prev.by)
            );
            const maxPre = Math.max(jumpAPre, jumpBPre);
            engine.xpbdFrameAccum.springs.firstPreIntegrateJumpPx = maxPre;
            engine.xpbdFrameAccum.springs.firstPreIntegrateNodeId = jumpAPre >= jumpBPre ? firstAId : firstBId;
        }
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

    // =========================================================================
    // XPBD FORCE PASS SEAM (RESERVED)
    // =========================================================================
    // This is the ONLY correct location to apply forces in XPBD mode.
    // Forces MUST be written before integrateNodes reads node.fx/fy.
    // Integration converts forces → velocity → position.
    // XPBD solver (later) corrects positions to satisfy constraints.
    //
    // Wire order: applyRepulsion → integrateNodes → solveXPBDEdgeConstraints
    // =========================================================================
    if (engine.config.xpbdRepulsionEnabled) {
        // Mini Run 1 (A1): Log repulsion status once at startup
        if (!engine.xpbdRepulsionLoggedOnce) {
            console.log('[XPBD Repulsion] Enabled: true (default ON for dev)');
            engine.xpbdRepulsionLoggedOnce = true;
        }

        // 1. Clear forces (explicit, local - not relying on legacy forcePass)
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 2. Build active/sleeping split
        // Note: Treating all as active for MVP to avoid missing pairs
        // (isSleeping may not be authoritative in XPBD mode yet)
        const activeNodes: PhysicsNode[] = [];
        const sleepingNodes: PhysicsNode[] = [];
        for (const node of nodeList) {
            if (node.isSleeping) {
                sleepingNodes.push(node);
            } else {
                activeNodes.push(node);
            }
        }

        // 3. Deterministic pairStride policy (Mini Run 5)
        // Avoid O(N²) death while keeping law continuous
        const N = nodeList.length;
        let pairStride = 1;  // Default: full coverage

        // Thresholds (deterministic, no random)
        const N_small = 150;   // Full coverage below this
        const N_medium = 300;  // Stride=2 (50% coverage)
        const N_large = 500;   // Stride=3 (33% coverage)

        // Hysteresis: Use 10% buffer to prevent flipping
        const hysteresis = 1.1;

        if (N > N_large * hysteresis) {
            pairStride = 4;  // 25% coverage for very large graphs
        } else if (N > N_medium * hysteresis) {
            pairStride = 3;  // 33% coverage
        } else if (N > N_small * hysteresis) {
            pairStride = 2;  // 50% coverage
        } else {
            pairStride = 1;  // Full coverage
        }

        // During drag: prefer full coverage for local responsiveness
        if (engine.draggedNodeId) {
            pairStride = Math.max(1, Math.floor(pairStride / 2));
        }

        // 4. Apply repulsion
        applyRepulsion(
            nodeList,           // all nodes (for density calc)
            activeNodes,        // active nodes
            sleepingNodes,      // sleeping nodes
            engine.config,      // force config
            debugStats,         // stats
            undefined,          // energy (not used in XPBD)
            pairStride,         // deterministic stride (1-4)
            0,                  // pairOffset
            undefined           // neighborCache (optional)
        );

        // 5. Update telemetry
        debugStats.safety.xpbdRepulsionEnabled = true;
        debugStats.safety.xpbdRepulsionCalledThisFrame = true;
        // Run 3: Repulsion Proof Canary (Source of Truth)
        debugStats.repulsionProof.enteredFrame = engine.frameIndex;
        debugStats.repulsionProof.calledThisFrame = true;
        debugStats.repulsionProof.enabled = true;

        // Run 5: Context Counters
        debugStats.repulsionProof.awakeCount = activeNodes.length;
        debugStats.repulsionProof.sleepingCount = sleepingNodes.length;
        debugStats.repulsionProof.stride = pairStride;
    }

    // STEP 3/5: XPBD-specific damping (separate from legacy)
    // When xpbdDamping is undefined, use XPBD default (NOT legacy config.damping)
    // User override: if xpbdDamping is set, it wins
    const rawDamping = engine.config.xpbdDamping ?? DEFAULT_XPBD_DAMPING;

    // RUN 4: Safety clamp to sane range [0, 2]
    // 0 = no damping (floaty), 2 = very heavy damping (k=10, half-life=0.07s)
    const effectiveDamping = Math.max(0, Math.min(2, rawDamping));

    // STEP 4/5 RUN 2: Rate-limited telemetry (change detection + time throttle)
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
        const configValue = engine.config.xpbdDamping;
        const clamped = rawDamping !== effectiveDamping;

        let source: 'DEFAULT' | 'CONFIG' | 'CLAMPED';
        if (configValue === undefined) {
            source = 'DEFAULT';
        } else if (clamped) {
            source = 'CLAMPED';
        } else {
            source = 'CONFIG';
        }

        const now = getNowMs();
        const sourceChanged = source !== lastTelemetrySource;
        const effectiveChanged = effectiveDamping !== lastTelemetryEffective;
        const timeSinceLast = now - lastTelemetryTime;
        const shouldLog = (sourceChanged || effectiveChanged) && timeSinceLast > 500;

        if (shouldLog) {
            const frameFactor = Math.exp(-effectiveDamping * 5.0 * dt);

            console.log('[DEV] XPBD damping telemetry:', {
                source,
                raw: rawDamping,
                effective: effectiveDamping,
                clamped,
                dt,
                frameFactor: frameFactor.toFixed(4),
                xpbdDefault: DEFAULT_XPBD_DAMPING,
                legacyDamping: engine.config.damping
            });

            lastTelemetrySource = source;
            lastTelemetryEffective = effectiveDamping;
            lastTelemetryTime = now;
        }
    }

    integrateNodes(
        engine as any,
        nodeList,
        dt,
        1.0,
        motionPolicy,
        effectiveDamping,  // Use XPBD-specific damping if provided
        engine.config.maxVelocity,
        debugStats,
        false,
        true
    );

    // 2b. Kinematic Drag Lock (Run 7)
    // Snap dragged node to target before solver sees it
    applyKinematicDrag(engine, dt);

    if (firstAId && firstBId) {
        const a0 = engine.nodes.get(firstAId);
        const b0 = engine.nodes.get(firstBId);
        if (a0 && b0) {
            preSolveAX = a0.x;
            preSolveAY = a0.y;
            preSolveBX = b0.x;
            preSolveBY = b0.y;
        }
    }

    // 3. Solver
    const nodeCount = nodeList.length;
    const preSolveSnapshot = new Float32Array(nodeCount * 2);
    for (let i = 0; i < nodeCount; i++) {
        preSolveSnapshot[i * 2 + 0] = nodeList[i].x;
        preSolveSnapshot[i * 2 + 1] = nodeList[i].y;
    }

    solveXPBDEdgeConstraints(engine, dt);

    if (firstAId && firstBId) {
        const a0 = engine.nodes.get(firstAId);
        const b0 = engine.nodes.get(firstBId);
        if (a0 && b0) {
            postSolveAX = a0.x;
            postSolveAY = a0.y;
            postSolveBX = b0.x;
            postSolveBY = b0.y;
        }
    }

    // 4. Reconcile
    reconcileAfterXPBDConstraints(engine, preSolveSnapshot, nodeList, dt);

    if (engine.xpbdFrameAccum && firstAId && firstBId) {
        const jumpAIntegrate = Math.sqrt(
            (preSolveAX - preIntegrateAX) * (preSolveAX - preIntegrateAX) +
            (preSolveAY - preIntegrateAY) * (preSolveAY - preIntegrateAY)
        );
        const jumpBIntegrate = Math.sqrt(
            (preSolveBX - preIntegrateBX) * (preSolveBX - preIntegrateBX) +
            (preSolveBY - preIntegrateBY) * (preSolveBY - preIntegrateBY)
        );
        const jumpASolve = Math.sqrt(
            (postSolveAX - preSolveAX) * (postSolveAX - preSolveAX) +
            (postSolveAY - preSolveAY) * (postSolveAY - preSolveAY)
        );
        const jumpBSolve = Math.sqrt(
            (postSolveBX - preSolveBX) * (postSolveBX - preSolveBX) +
            (postSolveBY - preSolveBY) * (postSolveBY - preSolveBY)
        );

        const maxIntegrate = Math.max(jumpAIntegrate, jumpBIntegrate);
        const maxSolve = Math.max(jumpASolve, jumpBSolve);
        let phase: 'integrate' | 'solver' | 'none' = 'none';
        let nodeId: string | null = null;
        let maxJump = 0;

        if (maxIntegrate > 0 || maxSolve > 0) {
            if (maxSolve >= maxIntegrate) {
                phase = 'solver';
                maxJump = maxSolve;
                nodeId = jumpASolve >= jumpBSolve ? firstAId : firstBId;
            } else {
                phase = 'integrate';
                maxJump = maxIntegrate;
                nodeId = jumpAIntegrate >= jumpBIntegrate ? firstAId : firstBId;
            }
        }

        engine.xpbdFrameAccum.springs.firstJumpPx = maxJump;
        engine.xpbdFrameAccum.springs.firstJumpPhase = phase;
        engine.xpbdFrameAccum.springs.firstJumpNodeId = nodeId;

        const preJump = engine.xpbdFrameAccum.springs.firstPreIntegrateJumpPx || 0;
        const preNode = engine.xpbdFrameAccum.springs.firstPreIntegrateNodeId;
        let movePhase: 'pre' | 'integrate' | 'solver' | 'none' = 'none';
        let movePx = 0;
        let moveNode: string | null = null;
        if (preJump > 0 || maxJump > 0) {
            if (preJump >= maxJump) {
                movePhase = 'pre';
                movePx = preJump;
                moveNode = preNode;
            } else {
                movePhase = phase === 'none' ? 'integrate' : phase;
                movePx = maxJump;
                moveNode = nodeId;
            }
        }
        engine.xpbdFrameAccum.springs.firstMovePx = movePx;
        engine.xpbdFrameAccum.springs.firstMovePhase = movePhase;
        engine.xpbdFrameAccum.springs.firstMoveNodeId = moveNode;
    }

    if (firstAId && firstBId) {
        const a0 = engine.nodes.get(firstAId);
        const b0 = engine.nodes.get(firstBId);
        if (a0 && b0) {
            engine.xpbdFirstPairPrev = {
                aId: firstAId,
                bId: firstBId,
                ax: a0.x,
                ay: a0.y,
                bx: b0.x,
                by: b0.y
            };
        }
    }

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

