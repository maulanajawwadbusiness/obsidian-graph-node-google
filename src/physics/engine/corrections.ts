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

    // SOFT RECONCILE (Secondary)
    // Fade out corrections as system cools to prevent micro-jitter near rest.
    // We use the energy envelope (policy.temperature) or similar proxy.
    // If energy < 0.2, we scale budget down.
    if (policy.temperature < 0.2) {
        // Ramp from 1.0 down to 0.0
        const fade = Math.max(0, policy.temperature / 0.2);
        // Curve it (smoothstep) -> 3x^2 - 2x^3
        const smooth = fade * fade * (3 - 2 * fade);
        nodeBudget *= smooth;
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

        // FIX 11: DIFFUSION PRESSURE GATE (Continuous)
        // Stop Diffusion Motor: Gate by settle confidence
        const settleConfidence = policy.settleScalar || 0;
        const diffusionSettleGate = Math.pow(1 - settleConfidence, 2);

        // Continuous Entry: 0.1 -> 0.3 (Smoothstep)
        // Previous (totalMag - 0.2) / 0.6 was effectively a linear ramp starting at 0.2
        // We use smoothstep for nicer falloff
        const magLow = 0.1;
        const magHigh = 0.3;
        const t = Math.max(0, Math.min(1, (totalMag - magLow) / (magHigh - magLow)));
        const magWeight = t * t * (3 - 2 * t);

        const diffusionEffective = engine.config.correctionDiffusionBase *
            policy.diffusion *
            diffusionSettleGate *
            magWeight;

        // Scale diffusion strength by our confidence
        // gate > 0.0001

        // FIX 17: Track budget hits/Residuals


        // FIX 17: Track budget hits/Residuals
        let clipped = false;

        // ADAPTIVE CAP (Fix 46)
        // If node was clipped recently, give it a temporary bonus.
        // This prevents "persistent twitching" by allowing release.
        if (node.correctionClipped && node.correctionClipped > 1.0) {
            // Boost budget for next frame
            node.budgetBonus = Math.min((node.budgetBonus || 0) + nodeBudget * 0.1, nodeBudget * 1.0);
        } else {
            // Decay bonus
            node.budgetBonus = (node.budgetBonus || 0) * 0.9;
        }

        const effectiveBudget = nodeBudget + (node.budgetBonus || 0);

        if (totalMag > effectiveBudget) {
            stats.safety.correctionBudgetHits += 1;
            stats.safety.corrClippedTotal += (totalMag - effectiveBudget);
            node.correctionClipped = totalMag - effectiveBudget;
            clipped = true;
        } else {
            node.correctionClipped = 0;
        }

        // Degree-weighted resistance (hubs act heavier)
        const degree = nodeDegree.get(node.id) || 1;
        const degreeScale = 1 / Math.sqrt(degree);

        // Normalize new direction
        const newDir = { x: accDx / totalMag, y: accDy / totalMag };

        // Check directional continuity
        let attenuationFactor = 1.0;
        let signFlip = false;

        if (node.lastCorrectionDir) {
            const dot = newDir.x * node.lastCorrectionDir.x + newDir.y * node.lastCorrectionDir.y;
            if (dot < -0.5) { // Significant reversal (>120 deg)
                attenuationFactor = 0.2;
                signFlip = true;
                node.corrSignFlip = true;
                stats.corrSignFlipCount++;
            } else {
                node.corrSignFlip = false;
            }
        } else {
            node.corrSignFlip = false;
        }

        // PHASE-AWARE HUB INERTIA
        const hubFactor = Math.min(Math.max((degree - 2) / 3, 0), 1);
        const inertiaStrength = 0.6;
        const hubInertiaScale = 1 - (hubFactor * inertiaStrength * policy.hubInertiaBlend);

        // Clamp to budget and apply attenuation + degree scaling + hub inertia
        const budgetScale = Math.min(1, effectiveBudget / totalMag);
        const scale = budgetScale * attenuationFactor * degreeScale * hubInertiaScale;

        const corrDx = accDx * scale;
        const corrDy = accDy * scale;

        // CORRECTION TAX (Knife-Cut)
        // If velocity opposes correction, it is feeding a limit cycle (fighting).
        // We MUST tax this velocity to break the cycle.
        const vDotCorr = node.vx * corrDx + node.vy * corrDy;
        if (vDotCorr < 0) {
            conflictCount += 1;
            node.conflictThisFrame = 1;

            // Project V onto C and kill the opposing component
            // C is (corrDx, corrDy). 
            const cMagSq = corrDx * corrDx + corrDy * corrDy;
            if (cMagSq > 0.000001) {
                const projFactor = vDotCorr / cMagSq; // (V . C) / (C . C) (Negative value)
                // V_parallel = projFactor * C represents the component of V fighting C.
                // We subtract a large portion of it (Correction Tax).
                // Tax Rate: 0.9 (90% damping of fighting component)
                const taxRate = 0.9;
                node.vx -= (projFactor * corrDx) * taxRate;
                node.vy -= (projFactor * corrDy) * taxRate;
            }
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
                // FIX 40: Over-constraint Relaxation
                // If we are heavily clipping (budgetScale small), we must decay debt faint faster
                // to prevent accumulation of "impossible" constraints.
                // budgetScale = 1.0 (no clip) -> decay 0.8
                // budgetScale = 0.1 (hard clip) -> decay 0.5 (flush it out)
                const decayBase = 0.8;
                const decay = budgetOnlyScale < 0.5 ? 0.5 : decayBase;

                const residualDx = remDx * decay;
                const residualDy = remDy * decay;
                const resMag = Math.sqrt(residualDx * residualDx + residualDy * residualDy);

                if (resMag > 0.5) {
                    node.correctionResidual = { dx: residualDx, dy: residualDy };
                    // Track global debt
                    stats.safety.debtTotal += resMag;
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

        // Helper: Reconcile Velocity (Ghost Velocity Fix - Strategy A: History Follow)
        // Principle: Positional corrections are teleports to valid state.
        // They should NOT affect momentum (v).
        const reconcile = (_nx: number, _ny: number) => {
            // Original "reconcile" added v += dx/dt, which created kinetic energy from PBD.
            // We now DISABLE this injection to stop ghost velocity.

            /* GHOST VELOCITY FIX: DISABLED
            if (diffusionSettleGate < 0.01) return;
            const vxImplicit = nx / dt;
            const vyImplicit = ny / dt;
            const vMag = Math.sqrt(vxImplicit * vxImplicit + vyImplicit * vyImplicit);
            const maxReconcileSpeed = 500;
            let safeScale = 1.0;
            if (vMag > maxReconcileSpeed) safeScale = maxReconcileSpeed / vMag;
            node.vx += vxImplicit * safeScale * diffusionSettleGate;
            node.vy += vyImplicit * safeScale * diffusionSettleGate;
            */
        };

        // DIFFUSION: split correction between self and neighbors
        // FIX 11: Gate diffusion by pressure threshold
        if (degree > 1 && diffusionEffective > 0.0001) {
            const densityAttenuation = 1 / (1 + Math.max(0, degree - 2) * engine.config.correctionDiffusionDensityScale);
            const spacingAttenuation = 1 - spacingGate * engine.config.correctionDiffusionSpacingScale;
            // Note: magWeight now handles the magnitude gate, so we don't need double gating here unless config implies it?
            // Actually config.correctionDiffusionMin logic was to FLOOR it? 
            // "correctionDiffusionMin" name suggests a floor for the SCALE factor.
            // Let's keep the attenuation logic but multiply by our continuous weight.

            const diffusionScale = Math.max(
                engine.config.correctionDiffusionMin,
                Math.min(1, densityAttenuation * spacingAttenuation)
            );

            // "neighborShareTotal" = strength * scale
            // diffusionEffective already includes policy.diffusion + settleGate + magWeight
            // So we just multiply by the structural attenuations
            const neighborShareTotal = diffusionEffective * diffusionScale;

            // Safety cap: Never give away more than 90%
            const safeShare = Math.min(neighborShareTotal, 0.9);
            const selfShare = 1 - safeShare;
            const neighborShare = safeShare / degree;

            // Self gets share
            const selfDx = corrDx * selfShare;
            const selfDy = corrDy * selfShare;
            node.x += selfDx;
            node.y += selfDy;
            if (node.prevX !== undefined) node.prevX += selfDx;
            if (node.prevY !== undefined) node.prevY += selfDy;
            reconcile(selfDx, selfDy);

            passStats.correction += Math.sqrt(selfDx ** 2 + selfDy ** 2);
            affected.add(node.id);

            // Neighbors get share
            const neighbors = nodeNeighbors.get(node.id) || [];

            // FIX: Stable Neighbor Selection (Anti-Jitter)
            // If we have more neighbors than limit, we MUST be deterministic about which ones we pick.
            // Using raw array order is unstable if links change or engine reorders.
            // Sort by: (1) Distance Squared (Physical Closeness), (2) ID (Deterministic Tie-break)
            // Only sort if we actually need to truncate.
            let activeNeighbors = neighbors;
            if (maxDiffusionNeighbors && maxDiffusionNeighbors > 0 && neighbors.length > maxDiffusionNeighbors) {
                // Sort in place? No, copy to avoid mutating cache (though map value arrays might be fresh?) 
                // Note: nodeNeighbors is rebuilt frame-by-frame in this file (lines 45-58), so mutation is safe within frame.
                // HOWEVER: Calculating distSq for all neighbors is expensive?
                // Most nodes have < 10 neighbors. Sorting 10 items is trivial.

                // We need to access neighbor nodes to get positions.
                activeNeighbors.sort((aId, bId) => {
                    const nA = engine.nodes.get(aId);
                    const nB = engine.nodes.get(bId);
                    if (!nA || !nB) return 0;
                    const dSqA = (nA.x - node.x) ** 2 + (nA.y - node.y) ** 2;
                    const dSqB = (nB.x - node.x) ** 2 + (nB.y - node.y) ** 2;
                    if (Math.abs(dSqA - dSqB) > 0.0001) return dSqA - dSqB; // Ascending Distance
                    return aId.localeCompare(bId); // Stable ID fallback
                });
                // Truncate
                activeNeighbors = activeNeighbors.slice(0, maxDiffusionNeighbors);
            }

            // Forensic: Neighbor Jitter Check
            // Calculate cheap checksum of active neighbors
            if (activeNeighbors.length > 0) {
                let checkSum = 0;
                // Simple XOR sum of string lengths + first char + last char
                // This is O(N) but N is small (limit is usually < 8).
                // To be robust against sorting, sorting must have happened.
                // We did sort above.
                for (let k = 0; k < activeNeighbors.length; k++) {
                    const nid = activeNeighbors[k];
                    const code = nid.charCodeAt(0) + (nid.length << 8);
                    checkSum = (checkSum + code) & 0xFFFFFF;
                    // Rotate
                    checkSum = ((checkSum << 1) | (checkSum >>> 23));
                }

                if (node.lastNeighborHash !== undefined && node.lastNeighborHash !== checkSum) {
                    stats.neighborDeltaRate++;
                }
                node.lastNeighborHash = checkSum;
            } else {
                node.lastNeighborHash = 0;
            }

            const neighborLimit = activeNeighbors.length;
            for (let i = 0; i < neighborLimit; i++) {
                const nbId = activeNeighbors[i];
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

            // FIX: Valid Reconciliation (No Ghost Velocity)
            const oldPrevX = node.prevX ?? node.x; // Fallback matches current (v=0)
            const oldPrevY = node.prevY ?? node.y;

            if (node.prevX !== undefined) node.prevX += corrDx;
            if (node.prevY !== undefined) node.prevY += corrDy;

            // Forensic: Ghost Mismatch Check
            if (node.prevX !== undefined && node.prevY !== undefined) {
                const shiftP = (node.x - (node.x - corrDx));
                const shiftPrev = (node.prevX - oldPrevX);
                if (Math.abs(shiftP - shiftPrev) > 0.0001) {
                    stats.ghostMismatchCount++;
                }
            }

            passStats.correction += Math.sqrt(corrDx * corrDx + corrDy * corrDy);
            affected.add(node.id);
        }

        // Update lastCorrectionDir via slow lerp (heavy inertia)
        if (!node.lastCorrectionDir) {
            node.lastCorrectionDir = { x: newDir.x, y: newDir.y };
        } else {
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

                    const dbx = diff.dx * diffScale;
                    const dby = diff.dy * diffScale;
                    node.x += dbx;
                    node.y += dby;

                    const oldPrevX = node.prevX ?? node.x;

                    if (node.prevX !== undefined) node.prevX += dbx;
                    if (node.prevY !== undefined) node.prevY += dby;

                    // Forensic Check
                    if (node.prevX !== undefined) {
                        const shiftP = dbx;
                        const shiftPrev = node.prevX - oldPrevX;
                        if (Math.abs(shiftP - shiftPrev) > 0.0001) {
                            stats.ghostMismatchCount++;
                        }
                    }

                    passStats.correction += Math.sqrt(dbx ** 2 + dby ** 2);
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
