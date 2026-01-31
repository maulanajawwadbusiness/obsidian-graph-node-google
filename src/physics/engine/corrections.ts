import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import type { MotionPolicy } from './motionPolicy';
import { getPassStats, type DebugStats } from './stats';

export const applyCorrectionsWithDiffusion = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    policy: MotionPolicy,
    spacingGate: number,
    stats: DebugStats,
    dt: number,
    maxDiffusionNeighbors?: number
) => {
    // =====================================================================
    // FINAL PASS: APPLY CLAMPED CORRECTIONS WITH DIFFUSION
    // Degree-weighted resistance + neighbor diffusion to prevent pressure concentration
    // =====================================================================
    const timeScale = dt * 60.0;
    const conflictEmaBlend = 1 - Math.pow(0.7, timeScale);
    let nodeBudget = engine.config.maxNodeCorrectionPerFrame * timeScale;

    // FIX 45: Kill Delayed Debt (Boost Budget during Interaction)
    // If user is interacting, we want to resolve constraints IMMEDIATELY.
    // No saving debt for later. "Pay now".
    if (engine.draggedNodeId) {
        nodeBudget *= 3.0; // 3x budget allows instant resolution of most overlaps
    }

    // Compute node degree and neighbor map
    const nodeDegree = new Map<string, number>();
    const nodeNeighbors = new Map<string, string[]>();
    let conflictCount = 0;

    for (const node of nodeList) {
        node.conflictThisFrame = 0;
        nodeDegree.set(node.id, 0);
        nodeNeighbors.set(node.id, []);
    }
    for (const link of engine.links) {
        nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
        nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
        nodeNeighbors.get(link.source)?.push(link.target);
        nodeNeighbors.get(link.target)?.push(link.source);
    }

    // Track which nodes receive diffused correction this frame
    const diffusedCorrection = new Map<string, { dx: number; dy: number }>();
    for (const node of nodeList) {
        diffusedCorrection.set(node.id, { dx: 0, dy: 0 });
    }

    const passStats = getPassStats(stats, 'Corrections');
    const affected = new Set<string>();

    for (const node of nodeList) {
        // Fix 13: Capture constraint pressure
        const accum = correctionAccum.get(node.id);

        // FIX 17: Correction Debt Repayment
        // Add unpaid residual from previous frames
        let accDx = accum ? accum.dx : 0;
        let accDy = accum ? accum.dy : 0;

        if (node.correctionResidual) {
            accDx += node.correctionResidual.dx;
            accDy += node.correctionResidual.dy;
        }

        const totalMag = Math.sqrt(accDx * accDx + accDy * accDy);
        node.lastCorrectionMag = totalMag;

        if (node.isFixed) {
            // Clear residual if fixed (force resolved by anchor)
            node.correctionResidual = undefined;
            continue;
        }

        // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
        const deg = nodeDegree.get(node.id) || 0;
        if (deg === 1) {
            node.correctionResidual = undefined;
            continue;
        }

        if (totalMag < 0.001) {
            node.correctionResidual = undefined;
            continue;  // Skip tiny corrections
        }

        // FIX 11: DIFFUSION PRESSURE GATE
        // Only diffuse if there is significant local pressure.
        // FIX 34: Invisible Settling (Energy Gate)
        // Disable diffusion at low energy to prevent visible "relaxation" or creep.
        const diffusionThreshold = 0.5; // px per frame
        const enableDiffusion = totalMag > diffusionThreshold && policy.diffusion > 0.01;

        // FIX 17: Track budget hits/Residuals
        let clipped = false;
        if (totalMag > nodeBudget) {
            stats.safety.correctionBudgetHits += 1;
            clipped = true;
        }

        // Degree-weighted resistance (hubs act heavier)
        const degree = nodeDegree.get(node.id) || 1;
        const degreeScale = 1 / Math.sqrt(degree);

        // Normalize new direction
        const newDir = { x: accDx / totalMag, y: accDy / totalMag };

        // Check directional continuity
        let attenuationFactor = 1.0;
        if (node.lastCorrectionDir) {
            const dot = newDir.x * node.lastCorrectionDir.x + newDir.y * node.lastCorrectionDir.y;
            if (dot < 0) {
                attenuationFactor = 0.2;
            }
        }

        // PHASE-AWARE HUB INERTIA
        const hubFactor = Math.min(Math.max((degree - 2) / 3, 0), 1);
        const inertiaStrength = 0.6;
        const hubInertiaScale = 1 - (hubFactor * inertiaStrength * policy.hubInertiaBlend);

        // Clamp to budget and apply attenuation + degree scaling + hub inertia
        const budgetScale = Math.min(1, nodeBudget / totalMag);
        const scale = budgetScale * attenuationFactor * degreeScale * hubInertiaScale;

        const corrDx = accDx * scale;
        const corrDy = accDy * scale;
        const correctionOpposesVelocity = (corrDx * node.vx + corrDy * node.vy) < 0;
        if (correctionOpposesVelocity) {
            conflictCount += 1;
            node.conflictThisFrame = 1;
        }

        // FIX 17: Store Residual
        if (clipped || scale < 1.0) {
            // Determine what wasn't paid. 
            // Note: attenuationFactor/degreeScale etc are "physical resistance", not "unpaid debt".
            // Debt is only what is cut by BUDGET.
            // If physics says "resist", that's not debt.
            // However, budget clipping IS debt.
            // Only track debt if budgetScale < 1.0

            if (budgetScale < 1.0) {
                const budgetOnlyScale = budgetScale; // Just the budget cut
                const paidDx = accDx * budgetOnlyScale;
                const paidDy = accDy * budgetOnlyScale;
                const remDx = accDx - paidDx;
                const remDy = accDy - paidDy;

                // Decay debt (0.8) to prevent explosion
                // FIX 35: Bounded Debt (Snap to Zero)
                // If residual is small, kill it immediately to prevent long-tail "ghost movement".
                const residualDx = remDx * 0.8;
                const residualDy = remDy * 0.8;
                const resMag = Math.sqrt(residualDx * residualDx + residualDy * residualDy);

                if (resMag > 0.5) {
                    node.correctionResidual = { dx: residualDx, dy: residualDy };
                } else {
                    node.correctionResidual = undefined;
                }

                // if (engine.config.debugPerf) console.warn('[CorrCap] Debt stored', node.id);
            } else {
                node.correctionResidual = undefined;
            }
        } else {
            node.correctionResidual = undefined;
        }

        // DIFFUSION: split correction between self and neighbors
        // FIX 11: Gate diffusion by pressure threshold
        if (degree > 1 && enableDiffusion) {
            const densityAttenuation = 1 / (1 + Math.max(0, degree - 2) * engine.config.correctionDiffusionDensityScale);
            const spacingAttenuation = 1 - spacingGate * engine.config.correctionDiffusionSpacingScale;
            const diffusionScale = Math.max(
                engine.config.correctionDiffusionMin,
                Math.min(1, densityAttenuation * spacingAttenuation)
            );
            const neighborShareTotal = engine.config.correctionDiffusionBase * diffusionScale * policy.diffusion;
            const selfShare = 1 - neighborShareTotal;
            const neighborShare = neighborShareTotal / degree;

            // Self gets share
            node.x += corrDx * selfShare;
            node.y += corrDy * selfShare;
            passStats.correction += Math.sqrt((corrDx * selfShare) ** 2 + (corrDy * selfShare) ** 2);
            affected.add(node.id);

            // Neighbors get share
            const neighbors = nodeNeighbors.get(node.id) || [];
            const neighborLimit = maxDiffusionNeighbors && maxDiffusionNeighbors > 0
                ? Math.min(neighbors.length, maxDiffusionNeighbors)
                : neighbors.length;
            for (let i = 0; i < neighborLimit; i++) {
                const nbId = neighbors[i];
                // FIX #7: Do not diffuse corrections TO fixed nodes
                const neighborNode = engine.nodes.get(nbId);
                if (neighborNode && neighborNode.isFixed) continue;

                const nbDiff = diffusedCorrection.get(nbId);
                if (nbDiff) {
                    // Neighbors receive opposite direction (they move to absorb)
                    nbDiff.dx -= corrDx * neighborShare;
                    nbDiff.dy -= corrDy * neighborShare;
                }
            }
        } else {
            // Single connection - apply full correction
            node.x += corrDx;
            node.y += corrDy;
            passStats.correction += Math.sqrt(corrDx * corrDx + corrDy * corrDy);
            affected.add(node.id);
        }

        // Update lastCorrectionDir via slow lerp (heavy inertia)
        if (!node.lastCorrectionDir) {
            node.lastCorrectionDir = { x: newDir.x, y: newDir.y };
        } else {
            // Original: lerpFactor = 0.3
            // Time-correct: factor = 1 - pow(1 - 0.3, dt * 60)
            // 0.3 means we keep 70% of old value.
            const lerpFactor = 1 - Math.pow(0.7, timeScale);
            const lx = node.lastCorrectionDir.x * (1 - lerpFactor) + newDir.x * lerpFactor;
            const ly = node.lastCorrectionDir.y * (1 - lerpFactor) + newDir.y * lerpFactor;
            const lmag = Math.sqrt(lx * lx + ly * ly);
            if (lmag > 0.001) {
                node.lastCorrectionDir.x = lx / lmag;
                node.lastCorrectionDir.y = ly / lmag;
            }
        }
    }

    // Apply diffused corrections to neighbors (clamped to budget)
    for (const node of nodeList) {
        if (!node.isFixed) {
            const diff = diffusedCorrection.get(node.id);
            if (diff) {
                const diffMag = Math.sqrt(diff.dx * diff.dx + diff.dy * diff.dy);
                if (diffMag >= 0.001) {
                    // FIX 20: DAMPEN LOCAL DRIFT
                    // If this node is connected to the dragged node, dampen diffusion
                    // to prevent "sideways squirt" feeling.
                    let localDamping = 1.0;
                    if (engine.draggedNodeId) {
                        const neighbors = nodeNeighbors.get(engine.draggedNodeId);
                        if (neighbors && neighbors.includes(node.id)) {
                            localDamping = 0.2; // 80% reduction in lateral diffusion
                        }
                    }

                    // Clamp diffused correction to budget
                    // Apply local damping to diffusion reception
                    const diffScale = Math.min(1, nodeBudget / diffMag) * localDamping;

                    node.x += diff.dx * diffScale;
                    node.y += diff.dy * diffScale;
                    passStats.correction += Math.sqrt((diff.dx * diffScale) ** 2 + (diff.dy * diffScale) ** 2);
                    affected.add(node.id);
                    const diffusionOpposesVelocity = (diff.dx * node.vx + diff.dy * node.vy) < 0;
                    if (diffusionOpposesVelocity) {
                        conflictCount += 1;
                        node.conflictThisFrame = 1;
                    }
                }
            }
        }

        const conflictTarget = node.conflictThisFrame ? 1 : 0;
        const prevConflict = node.conflictEma ?? 0;
        node.conflictEma = prevConflict + (conflictTarget - prevConflict) * conflictEmaBlend;
        node.conflictThisFrame = 0;
    }

    passStats.nodes += affected.size;
    stats.correctionConflictCount += conflictCount;
};
