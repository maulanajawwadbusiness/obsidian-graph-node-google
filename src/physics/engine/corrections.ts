import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';

export const applyCorrectionsWithDiffusion = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    energy: number,
    spacingGate: number,
    stats: DebugStats
) => {
    // =====================================================================
    // FINAL PASS: APPLY CLAMPED CORRECTIONS WITH DIFFUSION
    // Degree-weighted resistance + neighbor diffusion to prevent pressure concentration
    // =====================================================================
    const nodeBudget = engine.config.maxNodeCorrectionPerFrame;

    // Compute node degree and neighbor map
    const nodeDegree = new Map<string, number>();
    const nodeNeighbors = new Map<string, string[]>();
    for (const node of nodeList) {
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
        if (node.isFixed) continue;

        // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
        const deg = nodeDegree.get(node.id) || 0;
        if (deg === 1) continue;

        const accum = correctionAccum.get(node.id);
        if (!accum) continue;

        // Total correction magnitude
        let totalMag = Math.sqrt(accum.dx * accum.dx + accum.dy * accum.dy);

        if (totalMag < 0.001) continue;  // Skip tiny corrections

        if (totalMag > nodeBudget) {
            stats.safety.correctionBudgetHits += 1;
        }

        // Degree-weighted resistance (hubs act heavier)
        const degree = nodeDegree.get(node.id) || 1;
        const degreeScale = 1 / Math.sqrt(degree);

        // Normalize new direction
        const newDir = { x: accum.dx / totalMag, y: accum.dy / totalMag };

        // Check directional continuity
        let attenuationFactor = 1.0;
        if (node.lastCorrectionDir) {
            const dot = newDir.x * node.lastCorrectionDir.x + newDir.y * node.lastCorrectionDir.y;
            if (dot < 0) {
                attenuationFactor = 0.2;
            }
        }

        // PHASE-AWARE HUB INERTIA: high-degree nodes absorb corrections gradually
        // Prevents synchronization spike during expansion→settling transition
        // hubFactor = 0 for leaves, 1 for high-degree hubs
        const hubFactor = Math.min(Math.max((degree - 2) / 3, 0), 1);
        const inertiaStrength = 0.6;  // How much to slow hub correction acceptance
        // Active during transition (energy 0.4-0.7) and settling
        const hubInertiaScale = energy < 0.8 ? (1 - hubFactor * inertiaStrength) : 1.0;

        // Clamp to budget and apply attenuation + degree scaling + hub inertia
        const scale = Math.min(1, nodeBudget / totalMag) * attenuationFactor * degreeScale * hubInertiaScale;
        const corrDx = accum.dx * scale;
        const corrDy = accum.dy * scale;

        // DIFFUSION: split correction between self and neighbors
        if (degree > 1) {
            const densityAttenuation = 1 / (1 + Math.max(0, degree - 2) * engine.config.correctionDiffusionDensityScale);
            const spacingAttenuation = 1 - spacingGate * engine.config.correctionDiffusionSpacingScale;
            const diffusionScale = Math.max(
                engine.config.correctionDiffusionMin,
                Math.min(1, densityAttenuation * spacingAttenuation)
            );
            const neighborShareTotal = engine.config.correctionDiffusionBase * diffusionScale;
            const selfShare = 1 - neighborShareTotal;
            const neighborShare = neighborShareTotal / degree;

            // Self gets 40%
            node.x += corrDx * selfShare;
            node.y += corrDy * selfShare;
            passStats.correction += Math.sqrt((corrDx * selfShare) ** 2 + (corrDy * selfShare) ** 2);
            affected.add(node.id);

            // Neighbors get 60% split
            const neighbors = nodeNeighbors.get(node.id) || [];
            for (const nbId of neighbors) {
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
            const lerpFactor = 0.3;
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
        if (node.isFixed) continue;

        const diff = diffusedCorrection.get(node.id);
        if (!diff) continue;

        const diffMag = Math.sqrt(diff.dx * diff.dx + diff.dy * diff.dy);
        if (diffMag < 0.001) continue;

        // Clamp diffused correction to budget
        const diffScale = Math.min(1, nodeBudget / diffMag);
        node.x += diff.dx * diffScale;
        node.y += diff.dy * diffScale;
        passStats.correction += Math.sqrt((diff.dx * diffScale) ** 2 + (diff.dy * diffScale) ** 2);
        affected.add(node.id);
    }

    passStats.nodes += affected.size;
};
