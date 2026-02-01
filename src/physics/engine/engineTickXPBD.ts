import type { PhysicsEngineTickContext } from './engineTickTypes';
import { runTickPreflight } from './engineTickPreflight';
import { createDebugStats } from './stats';
import { getNowMs } from './engineTime';
import { updateHudSnapshot } from './engineTickHud';
import { finalizePhysicsTick } from './engineTickFinalize';
import { integrateNodes } from './integration';
import { createMotionPolicy } from './motionPolicy';
import { applyDragVelocity } from './velocity/dragVelocity';

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

            const MAX_DRAG_DISTANCE = 300; // px from initial grab position
            const initialX = engine.grabOffset.x;
            const initialY = engine.grabOffset.y;

            // Clamp dragTarget to be within MAX_DRAG_DISTANCE of initial position
            const targetDx = engine.dragTarget.x - initialX;
            const targetDy = engine.dragTarget.y - initialY;
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);

            let clampedTargetX = engine.dragTarget.x;
            let clampedTargetY = engine.dragTarget.y;

            if (targetDist > MAX_DRAG_DISTANCE) {
                const scale = MAX_DRAG_DISTANCE / targetDist;
                clampedTargetX = initialX + targetDx * scale;
                clampedTargetY = initialY + targetDy * scale;
            }

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
                const dx = relNode.x - (preSolveSnapshot[nodeList.indexOf(relNode) * 2] || relNode.prevX); // Approximation if index unavailable easily?
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
    let iter = 1;

    // Calibration Canary (Run 6)
    // If enabled, artificially shorten the first constraint to force visual error.
    if (USE_CANARY && engine.xpbdConstraints.length > 0) {
        // Validation check only
    }

    const constraints = engine.xpbdConstraints;
    const nodes = engine.nodes;

    // Mini Run 7 Part 4: Track pinned nodes (invMass=0)
    let pinnedCount = 0;
    const draggedNodePinned = engine.draggedNodeId !== null;
    if (draggedNodePinned) pinnedCount++;  // Dragged node is always pinned

    // TUG RUN PART 2: Track constraints involving dragged node (local tug activity)
    let dragConstraintCount = 0;

    // Solver Loop (Single Iteration)
    for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const nA = nodes.get(c.nodeA);
        const nB = nodes.get(c.nodeB);

        if (!nA || !nB) {
            skippedCount++;
            continue;
        }

        // Mini Run 7 Part 5: ENABLE local tug on neighbors
        // DO NOT skip constraints involving dragged node!
        // The dragged node has invMass=0 (pinned), so it won't move,
        // but neighbors WILL stretch toward it (local tug).
        // Previous code skipped these constraints, preventing local tug entirely.

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
        // TUG RUN PART 1: LOCAL TUG MECHANISM
        // - Dragged node: invMass=0 (pinned, won't move)
        // - Free neighbor: invMass=1 (can move)
        // - Constraint between them: ACTIVE (not skipped)
        // - Result: Neighbor stretches toward dragged node (LOCAL TUG)
        const wA = (nA.isFixed || nA.id === engine.draggedNodeId) ? 0 : 1.0;
        const wB = (nB.isFixed || nB.id === engine.draggedNodeId) ? 0 : 1.0;

        // Mini Run 7 Part 4: Count pinned nodes (avoid double-counting dragged node)
        if (wA === 0 && nA.id !== engine.draggedNodeId) pinnedCount++;
        if (wB === 0 && nB.id !== engine.draggedNodeId) pinnedCount++;

        // TUG RUN PART 2: Count constraints involving dragged node
        if (nA.id === engine.draggedNodeId || nB.id === engine.draggedNodeId) {
            dragConstraintCount++;
        }

        // Only skip if BOTH nodes are pinned (no degrees of freedom)
        if (wA + wB === 0) {
            skippedCount++;
            continue;
        }

        // 4. Alpha (Compliance)
        const alpha = c.compliance / (dt * dt);
        const wSum = wA + wB;

        // 5. Delta Lambda
        const denom = wA + wB + alpha;
        const deltaLambda = (-C - alpha * c.lambda) / denom;

        c.lambda += deltaLambda;

        // 6. Apply Correction
        // TUG RUN PART 3: CRITICAL FIX - Both nodes move in SAME direction along gradient
        // Previous bug: +wB caused neighbor to move AWAY from dragged node (reversed tug)
        // Correct: Both use -w to move together (reduce constraint error)
        let pxA = -wA * deltaLambda * gradX;
        let pyA = -wA * deltaLambda * gradY;
        let pxB = -wB * deltaLambda * gradX;  // FIXED: was +wB (caused reversed tug)
        let pyB = -wB * deltaLambda * gradY;  // FIXED: was +wB (caused reversed tug)

        // Safety Cap (Run 6)
        // Check magnitude of correction vectors
        let magA = Math.sqrt(pxA * pxA + pyA * pyA);
        let magB = Math.sqrt(pxB * pxB + pyB * pyB);

        let capHit = false;
        if (magA > MAX_CORR_PX) {
            const scale = MAX_CORR_PX / magA;
            pxA *= scale;
            pyA *= scale;
            magA = Math.sqrt(pxA * pxA + pyA * pyA); // Strict Recompute
            capHit = true;
        }
        if (magB > MAX_CORR_PX) {
            const scale = MAX_CORR_PX / magB;
            pxB *= scale;
            pyB *= scale;
            magB = Math.sqrt(pxB * pxB + pyB * pyB); // Strict Recompute
            capHit = true;
        }

        nA.x += pxA;
        nA.y += pyA;
        nB.x += pxB;
        nB.y += pyB;

        // Telemetry
        corrMax = Math.max(corrMax, magA, magB);
        corrSum += magA + magB;

        if (i === 0 && engine.xpbdFrameAccum) {
            engine.xpbdFrameAccum.springs.firstCapHit = capHit;
            engine.xpbdFrameAccum.springs.firstAlpha = alpha;
            engine.xpbdFrameAccum.springs.firstWSum = wSum;
        }

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

        // Mini Run 7 Part 4: Drag coupling telemetry
        s.pinnedCount = pinnedCount;
        s.draggedNodePinned = draggedNodePinned;
        s.dragConstraintCount = dragConstraintCount;  // TUG RUN PART 2
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
