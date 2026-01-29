import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';

export const initializeCorrectionAccum = (
    nodeList: PhysicsNode[],
    cache?: Map<string, { dx: number; dy: number }>,
    allocationCounter?: { newEntries: number }
) => {
    const correctionAccum = cache ?? new Map<string, { dx: number; dy: number }>();
    for (const node of nodeList) {
        const existing = correctionAccum.get(node.id);
        if (existing) {
            existing.dx = 0;
            existing.dy = 0;
        } else {
            correctionAccum.set(node.id, { dx: 0, dy: 0 });
            if (allocationCounter) allocationCounter.newEntries += 1;
        }
    }
    return correctionAccum;
};

export const applyEdgeRelaxation = (
    engine: PhysicsEngine,
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    stats: DebugStats
) => {
    // =====================================================================
    // POST-SOLVE EDGE RELAXATION (Shape nudge, not a force)
    // Gently nudge each edge toward target length after physics is done.
    // This creates perceptual uniformity without fighting physics.
    // =====================================================================
    const relaxStrength = 0.02; // 2% correction per frame
    const targetLen = engine.config.linkRestLength;

    const passStats = getPassStats(stats, 'EdgeRelaxation');
    const affected = new Set<string>();

    for (const link of engine.links) {
        const source = engine.nodes.get(link.source);
        const target = engine.nodes.get(link.target);
        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.1) continue;

        // How far off are we?
        const error = d - targetLen;

        // Small correction toward target (capped)
        const correction = error * relaxStrength;

        // Direction
        const nx = dx / d;
        const ny = dy / d;

        // Request correction via accumulator (split between nodes)
        // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
        const sourceAccum = correctionAccum.get(source.id);
        const targetAccum = correctionAccum.get(target.id);
        const sourceDeg = nodeDegreeEarly.get(source.id) || 0;
        const targetDeg = nodeDegreeEarly.get(target.id) || 0;

        if (!source.isFixed && !target.isFixed) {
            if (sourceAccum && sourceDeg > 1) {
                sourceAccum.dx += nx * correction * 0.5;
                sourceAccum.dy += ny * correction * 0.5;
                passStats.correction += Math.abs(correction) * 0.5;
                affected.add(source.id);
            }
            if (targetAccum && targetDeg > 1) {
                targetAccum.dx -= nx * correction * 0.5;
                targetAccum.dy -= ny * correction * 0.5;
                passStats.correction += Math.abs(correction) * 0.5;
                affected.add(target.id);
            }
        } else if (!source.isFixed && sourceAccum && sourceDeg > 1) {
            sourceAccum.dx += nx * correction;
            sourceAccum.dy += ny * correction;
            passStats.correction += Math.abs(correction);
            affected.add(source.id);
        } else if (!target.isFixed && targetAccum && targetDeg > 1) {
            targetAccum.dx -= nx * correction;
            targetAccum.dy -= ny * correction;
            passStats.correction += Math.abs(correction);
            affected.add(target.id);
        }
    }

    passStats.nodes += affected.size;
};

export const applySpacingConstraints = (
    engine: PhysicsEngine,
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    stats: DebugStats,
    spacingGate: number,
    pairStride: number = 1,
    pairOffset: number = 0
) => {
    // =====================================================================
    // DISTANCE-BASED SPACING (Soft pre-zone + Hard barrier)
    // Soft zone: resistance ramps up as dots approach hard barrier
    // Hard zone: guarantee separation (dots never touch)
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;
    if (spacingGate <= 0) return;

    const passStats = getPassStats(stats, 'SpacingConstraints');
    const affected = new Set<string>();
    const D_soft = D_hard * engine.config.softDistanceMultiplier;
    const softExponent = engine.config.softRepulsionExponent;
    const softMaxCorr = engine.config.softMaxCorrectionPx;

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    const applyPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (shouldSkipPair(a, b)) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d >= D_soft || d < 0.1) return;  // Outside soft zone or singularity

        // Normalize direction (from a toward b)
        const nx = dx / d;
        const ny = dy / d;

        let corr: number;

        if (d <= D_hard) {
            // HARD ZONE: smoothstep ramp to eliminate chattering
            const penetration = D_hard - d;
            const softnessBand = D_hard * engine.config.hardSoftnessBand;
            const t = Math.min(penetration / softnessBand, 1);
            const ramp = t * t * (3 - 2 * t);
            corr = penetration * ramp;
        } else {
            // SOFT ZONE: resistance ramps up as d approaches D_hard
            const t = (D_soft - d) / (D_soft - D_hard);
            const s = Math.pow(t, softExponent);
            corr = s * softMaxCorr;
        }

        const maxCorr = engine.config.maxCorrectionPerFrame;
        const corrApplied = Math.min(corr * spacingGate, maxCorr);

        // Request correction via accumulator (equal split)
        // DEGREE-1 EXCLUSION: dangling dots don't receive positional correction
        const aAccum = correctionAccum.get(a.id);
        const bAccum = correctionAccum.get(b.id);
        const aDeg = nodeDegreeEarly.get(a.id) || 0;
        const bDeg = nodeDegreeEarly.get(b.id) || 0;

        // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
        const aEscape = engine.escapeWindow.has(a.id);
        const bEscape = engine.escapeWindow.has(b.id);
        const aHubSkip = (energy > 0.85 && aDeg >= 3) || aEscape;
        const bHubSkip = (energy > 0.85 && bDeg >= 3) || bEscape;

        if (!a.isFixed && !b.isFixed) {
            if (aAccum && aDeg > 1 && !aHubSkip) {
                aAccum.dx -= nx * corrApplied * 0.5;
                aAccum.dy -= ny * corrApplied * 0.5;
                passStats.correction += Math.abs(corrApplied) * 0.5;
                affected.add(a.id);
            }
            if (bAccum && bDeg > 1 && !bHubSkip) {
                bAccum.dx += nx * corrApplied * 0.5;
                bAccum.dy += ny * corrApplied * 0.5;
                passStats.correction += Math.abs(corrApplied) * 0.5;
                affected.add(b.id);
            }
        } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
            aAccum.dx -= nx * corrApplied;
            aAccum.dy -= ny * corrApplied;
            passStats.correction += Math.abs(corrApplied);
            affected.add(a.id);
        } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
            bAccum.dx += nx * corrApplied;
            bAccum.dy += ny * corrApplied;
            passStats.correction += Math.abs(corrApplied);
            affected.add(b.id);
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const a = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(a, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(a, sleepingNodes[j]);
        }
    }

    passStats.nodes += affected.size;
};

export const applyTriangleAreaConstraints = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    stats: DebugStats
) => {
    // =====================================================================
    // TRIANGLE AREA SPRING (Face-level constraint, not spacing)
    // Each triangle has a rest area. If current area < rest area,
    // push vertices outward along altitude directions.
    // =====================================================================

    // Rest area for equilateral triangle with edge = linkRestLength
    const L = engine.config.linkRestLength;
    const restArea = (Math.sqrt(3) / 4) * L * L;
    const areaStrength = 0.0005 * energy;  // Very soft, fades with energy

    // Build adjacency set for triangle detection
    const connectedPairs = new Set<string>();
    for (const link of engine.links) {
        const key = [link.source, link.target].sort().join(':');
        connectedPairs.add(key);
    }

    // Find all triangles (A-B-C where all pairs connected)
    const triangles: [string, string, string][] = [];
    const nodeIds = nodeList.map(n => n.id);

    for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
            const keyAB = [nodeIds[i], nodeIds[j]].sort().join(':');
            if (!connectedPairs.has(keyAB)) continue;

            for (let k = j + 1; k < nodeIds.length; k++) {
                const keyAC = [nodeIds[i], nodeIds[k]].sort().join(':');
                const keyBC = [nodeIds[j], nodeIds[k]].sort().join(':');

                if (connectedPairs.has(keyAC) && connectedPairs.has(keyBC)) {
                    triangles.push([nodeIds[i], nodeIds[j], nodeIds[k]]);
                }
            }
        }
    }

    const passStats = getPassStats(stats, 'TriangleAreaConstraints');
    const affected = new Set<string>();

    // Apply area spring to each triangle
    for (const [idA, idB, idC] of triangles) {
        const a = engine.nodes.get(idA);
        const b = engine.nodes.get(idB);
        const c = engine.nodes.get(idC);
        if (!a || !b || !c) continue;

        // Current area (signed area formula, take absolute)
        const currentArea = 0.5 * Math.abs(
            (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
        );

        if (currentArea >= restArea) continue;  // Big enough

        // How much deficit?
        const deficit = restArea - currentArea;
        const correction = deficit * areaStrength;

        // Push each vertex outward along altitude direction
        // (from opposite edge midpoint toward vertex)
        const vertices = [
            { node: a, opp1: b, opp2: c },
            { node: b, opp1: a, opp2: c },
            { node: c, opp1: a, opp2: b }
        ];

        for (const { node, opp1, opp2 } of vertices) {
            if (node.isFixed) continue;

            // Midpoint of opposite edge
            const midX = (opp1.x + opp2.x) / 2;
            const midY = (opp1.y + opp2.y) / 2;

            // Direction from midpoint to vertex (altitude direction)
            const dx = node.x - midX;
            const dy = node.y - midY;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.1) continue;

            const nx = dx / d;
            const ny = dy / d;

            // Request correction via accumulator
            // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
            // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
            const nodeAccum = correctionAccum.get(node.id);
            const nodeDeg = nodeDegreeEarly.get(node.id) || 0;
            const nodeEscape = engine.escapeWindow.has(node.id);
            const earlyHubSkip = (energy > 0.85 && nodeDeg >= 3) || nodeEscape;
            if (nodeAccum && nodeDeg > 1 && !earlyHubSkip) {
                nodeAccum.dx += nx * correction;
                nodeAccum.dy += ny * correction;
                passStats.correction += Math.abs(correction);
                affected.add(node.id);
            }
        }
    }

    passStats.nodes += affected.size;
};

export const applySafetyClamp = (
    engine: PhysicsEngine,
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    stats: DebugStats,
    pairStride: number = 1,
    pairOffset: number = 0
) => {
    // =====================================================================
    // SAFETY CLAMP: hard positional correction only for deep violations
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;
    const passStats = getPassStats(stats, 'SafetyClamp');
    const affected = new Set<string>();

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    const applyPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (shouldSkipPair(a, b)) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < 0.1) return;  // Singularity guard

        const nx = dx / d;
        const ny = dy / d;

        if (d < D_hard) {
            const penetration = D_hard - d;

            stats.safety.penetrationTotal += penetration;
            stats.safety.penetrationCount += 1;

            if (penetration > 5) {
                stats.safety.clampTriggers += 1;

                const emergencyCorrection = Math.min(penetration - 5, 0.3);
                const aAccum = correctionAccum.get(a.id);
                const bAccum = correctionAccum.get(b.id);
                const aDeg = nodeDegreeEarly.get(a.id) || 0;
                const bDeg = nodeDegreeEarly.get(b.id) || 0;

                // EARLY-PHASE HUB PRIVILEGE: high-degree nodes skip clamp during early expansion
                const aHubSkip = energy > 0.85 && aDeg >= 3;
                const bHubSkip = energy > 0.85 && bDeg >= 3;

                if (!a.isFixed && !b.isFixed) {
                    if (aAccum && aDeg > 1 && !aHubSkip) {
                        aAccum.dx -= nx * emergencyCorrection * 0.5;
                        aAccum.dy -= ny * emergencyCorrection * 0.5;
                        passStats.correction += Math.abs(emergencyCorrection) * 0.5;
                        affected.add(a.id);
                    }
                    if (bAccum && bDeg > 1 && !bHubSkip) {
                        bAccum.dx += nx * emergencyCorrection * 0.5;
                        bAccum.dy += ny * emergencyCorrection * 0.5;
                        passStats.correction += Math.abs(emergencyCorrection) * 0.5;
                        affected.add(b.id);
                    }
                } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                    aAccum.dx -= nx * emergencyCorrection;
                    aAccum.dy -= ny * emergencyCorrection;
                    passStats.correction += Math.abs(emergencyCorrection);
                    affected.add(a.id);
                } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                    bAccum.dx += nx * emergencyCorrection;
                    bAccum.dy += ny * emergencyCorrection;
                    passStats.correction += Math.abs(emergencyCorrection);
                    affected.add(b.id);
                }
            }
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const a = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(a, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(a, sleepingNodes[j]);
        }
    }

    passStats.nodes += affected.size;
};
