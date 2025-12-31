import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';

export const initializeCorrectionAccum = (nodeList: PhysicsNode[]) => {
    const correctionAccum = new Map<string, { dx: number; dy: number }>();
    for (const node of nodeList) {
        correctionAccum.set(node.id, { dx: 0, dy: 0 });
    }
    return correctionAccum;
};

export const applyEdgeRelaxation = (
    engine: PhysicsEngine,
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>
) => {
    // =====================================================================
    // POST-SOLVE EDGE RELAXATION (Shape nudge, not a force)
    // Gently nudge each edge toward target length after physics is done.
    // This creates perceptual uniformity without fighting physics.
    // =====================================================================
    const relaxStrength = 0.02; // 2% correction per frame
    const targetLen = engine.config.linkRestLength;

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
            }
            if (targetAccum && targetDeg > 1) {
                targetAccum.dx -= nx * correction * 0.5;
                targetAccum.dy -= ny * correction * 0.5;
            }
        } else if (!source.isFixed && sourceAccum && sourceDeg > 1) {
            sourceAccum.dx += nx * correction;
            sourceAccum.dy += ny * correction;
        } else if (!target.isFixed && targetAccum && targetDeg > 1) {
            targetAccum.dx -= nx * correction;
            targetAccum.dy -= ny * correction;
        }
    }
};

export const applySpacingConstraints = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number
) => {
    // =====================================================================
    // DISTANCE-BASED SPACING (Soft pre-zone + Hard barrier)
    // Soft zone: resistance ramps up as nodes approach hard barrier
    // Hard zone: guarantee separation (dots never touch)
    // Gated by energy: completely disabled during expansion
    // Shadow barrier during expansion: prevent overlaps from deepening
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;

    if (energy <= 0.7) {
        // SETTLING PHASE: full spacing with smoothstep gate
        const D_soft = D_hard * engine.config.softDistanceMultiplier;
        const softExponent = engine.config.softRepulsionExponent;
        const softMaxCorr = engine.config.softMaxCorrectionPx;

        // Spacing gate: smoothstep for settling strength (0 at energy=0.7, 1 at energy=0.4)
        const gateT = Math.max(0, Math.min(1, (0.7 - energy) / 0.3));
        const spacingGate = gateT * gateT * (3 - 2 * gateT);  // smoothstep

        for (let i = 0; i < nodeList.length; i++) {
            const a = nodeList[i];

            for (let j = i + 1; j < nodeList.length; j++) {
                const b = nodeList[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d >= D_soft || d < 0.1) continue;  // Outside soft zone or singularity

                // Normalize direction (from a toward b)
                const nx = dx / d;
                const ny = dy / d;

                let corr: number;

                if (d <= D_hard) {
                    // HARD ZONE: smoothstep ramp to eliminate chattering
                    const penetration = D_hard - d;
                    const softnessBand = D_hard * engine.config.hardSoftnessBand;
                    const t = Math.min(penetration / softnessBand, 1);  // 0→1
                    const ramp = t * t * (3 - 2 * t);  // smoothstep
                    corr = penetration * ramp;
                } else {
                    // SOFT ZONE: resistance ramps up as d approaches D_hard
                    const t = (D_soft - d) / (D_soft - D_hard);  // 0 at D_soft, 1 at D_hard
                    const s = Math.pow(t, softExponent);
                    corr = s * softMaxCorr;
                }

                // Rate-limit and gate by energy (minimal during expansion)
                const maxCorr = engine.config.maxCorrectionPerFrame;
                const corrApplied = Math.min(corr * spacingGate, maxCorr);

                // Request correction via accumulator (equal split)
                // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
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
                    }
                    if (bAccum && bDeg > 1 && !bHubSkip) {
                        bAccum.dx += nx * corrApplied * 0.5;
                        bAccum.dy += ny * corrApplied * 0.5;
                    }
                } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                    aAccum.dx -= nx * corrApplied;
                    aAccum.dy -= ny * corrApplied;
                } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                    bAccum.dx += nx * corrApplied;
                    bAccum.dy += ny * corrApplied;
                }
            }
        }
    }  // End energy gate
};

export const applyTriangleAreaConstraints = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number
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
            }
        }
    }
};

export const applyAngleResistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegreeEarly: Map<string, number>,
    energy: number
) => {
    // =====================================================================
    // CONTINUOUS ANGLE RESISTANCE (Prevents cramped edges before violation)
    // 5 zones: Free (≥60°) → Pre-tension (45-60°) → Soft (30-45°) →
    //          Emergency (20-30°) → Forbidden (<20°)
    // Applies tangential velocity to push edges apart
    // =====================================================================

    // Zone boundaries (radians)
    const DEG_TO_RAD = Math.PI / 180;
    const ANGLE_FREE = 60 * DEG_TO_RAD;        // No resistance
    const ANGLE_PRETENSION = 45 * DEG_TO_RAD;  // Start gentle resistance
    const ANGLE_SOFT = 30 * DEG_TO_RAD;        // Main working zone
    const ANGLE_EMERGENCY = 20 * DEG_TO_RAD;   // Steep resistance + damping
    // Below ANGLE_EMERGENCY = Forbidden zone

    // Resistance multipliers by zone
    const RESIST_PRETENSION_MAX = 0.15;
    const RESIST_SOFT_MAX = 1.0;
    const RESIST_EMERGENCY_MAX = 3.5;
    const RESIST_FORBIDDEN = 8.0;

    // Base force strength
    const angleForceStrength = 25.0;

    // No expansion boost - angle resistance is phase-gated instead

    // Build adjacency map: node -> list of neighbors
    const neighbors = new Map<string, string[]>();
    for (const node of nodeList) {
        neighbors.set(node.id, []);
    }
    for (const link of engine.links) {
        neighbors.get(link.source)?.push(link.target);
        neighbors.get(link.target)?.push(link.source);
    }

    // For each node with 2+ neighbors
    for (const node of nodeList) {
        const nbIds = neighbors.get(node.id);
        if (!nbIds || nbIds.length < 2) continue;

        // Compute angle of each edge
        const edges: { id: string; angle: number; r: number }[] = [];
        for (const nbId of nbIds) {
            const nb = engine.nodes.get(nbId);
            if (!nb) continue;
            const dx = nb.x - node.x;
            const dy = nb.y - node.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < 0.1) continue;
            edges.push({ id: nbId, angle: Math.atan2(dy, dx), r });
        }

        // Sort by angle
        edges.sort((a, b) => a.angle - b.angle);

        // Check adjacent pairs (including wrap-around)
        for (let i = 0; i < edges.length; i++) {
            const curr = edges[i];
            const next = edges[(i + 1) % edges.length];

            // Angular difference (handle wrap-around)
            let theta = next.angle - curr.angle;
            if (theta < 0) theta += 2 * Math.PI;

            // Zone A: Free - no resistance
            if (theta >= ANGLE_FREE) continue;

            // PHASE-AWARE: During expansion, disable most angle resistance
            // Only allow emergency zones D/E to prevent collapse
            const isExpansion = energy > 0.7;

            // Compute resistance based on zone (continuous curve)
            let resistance: number;
            let localDamping = 1.0;

            if (theta >= ANGLE_PRETENSION) {
                // Zone B: Pre-tension (45-60°)
                if (isExpansion) continue;  // DISABLED during expansion
                const t = (ANGLE_FREE - theta) / (ANGLE_FREE - ANGLE_PRETENSION);
                const ease = t * t;  // Quadratic ease-in
                resistance = ease * RESIST_PRETENSION_MAX;
            } else if (theta >= ANGLE_SOFT) {
                // Zone C: Soft constraint (30-45°)
                if (isExpansion) continue;  // DISABLED during expansion
                const t = (ANGLE_PRETENSION - theta) / (ANGLE_PRETENSION - ANGLE_SOFT);
                const ease = t * t * (3 - 2 * t);  // Smoothstep
                resistance = RESIST_PRETENSION_MAX + ease * (RESIST_SOFT_MAX - RESIST_PRETENSION_MAX);
            } else if (theta >= ANGLE_EMERGENCY) {
                // Zone D: Emergency (20-30°)
                const t = (ANGLE_SOFT - theta) / (ANGLE_SOFT - ANGLE_EMERGENCY);
                const ease = t * t * t;  // Cubic ease-in
                // During expansion: reduced resistance (emergency only)
                const expansionScale = isExpansion ? 0.3 : 1.0;
                resistance = (RESIST_SOFT_MAX + ease * (RESIST_EMERGENCY_MAX - RESIST_SOFT_MAX)) * expansionScale;
                localDamping = isExpansion ? 1.0 : 0.92;  // No extra damping during expansion
            } else {
                // Zone E: Forbidden (<20°)
                const penetration = ANGLE_EMERGENCY - theta;
                const t = Math.min(penetration / (10 * DEG_TO_RAD), 1);
                // During expansion: prevent collapse only, don't open angles
                const expansionScale = isExpansion ? 0.5 : 1.0;
                resistance = (RESIST_EMERGENCY_MAX + t * (RESIST_FORBIDDEN - RESIST_EMERGENCY_MAX)) * expansionScale;
                localDamping = isExpansion ? 0.95 : 0.85;  // Lighter damping during expansion
            }

            // Get neighbor nodes
            const currNb = engine.nodes.get(curr.id);
            const nextNb = engine.nodes.get(next.id);
            if (!currNb || !nextNb) continue;

            // Force magnitude (no expansion boost - gating handles expansion)
            const force = resistance * angleForceStrength;

            // Apply tangential force (push edges apart along angle bisector)
            // currNb rotates clockwise, nextNb rotates counter-clockwise
            const applyTangentialForce = (nb: typeof currNb, edge: typeof curr, direction: number) => {
                if (nb.isFixed) return;
                const nbDeg = nodeDegreeEarly.get(nb.id) || 0;
                if (nbDeg === 1) return;  // Skip dangling nodes

                // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
                const nbEscape = engine.escapeWindow.has(nb.id);
                if ((energy > 0.85 && nbDeg >= 3) || nbEscape) return;

                // Tangent direction (perpendicular to radial)
                const radialX = (nb.x - node.x) / edge.r;
                const radialY = (nb.y - node.y) / edge.r;
                const tangentX = -radialY * direction;
                const tangentY = radialX * direction;

                // Apply as velocity (not position)
                nb.vx += tangentX * force;
                nb.vy += tangentY * force;

                // Apply local damping in emergency/forbidden zones
                if (localDamping < 1.0) {
                    nb.vx *= localDamping;
                    nb.vy *= localDamping;
                }
            };

            applyTangentialForce(currNb, curr, -1);  // Clockwise
            applyTangentialForce(nextNb, next, 1);   // Counter-clockwise
        }
    }
};

export const applyDistanceFieldBias = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number
) => {
    // =====================================================================
    // DISTANCE FIELD BIAS (Continuous resistance, not discrete correction)
    // When d < minDist, apply outward velocity bias (smooth, continuous)
    // Bias strength ramps with penetration depth
    // Hard positional clamp only as last-resort safety net
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;
    const releaseDist = D_hard + engine.config.clampHysteresisMargin;
    const biasStrength = 15.0;  // Outward velocity bias strength

    for (let i = 0; i < nodeList.length; i++) {
        const a = nodeList[i];
        for (let j = i + 1; j < nodeList.length; j++) {
            const b = nodeList[j];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < 0.1) continue;  // Singularity guard

            const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
            const wasClamped = engine.clampedPairs.has(pairKey);

            const nx = dx / d;
            const ny = dy / d;

            // Contact slop zone: gradual velocity projection before hitting hard wall
            const slop = engine.config.contactSlop;
            const slopStart = D_hard + slop;  // Start of gradual resistance zone

            if (d >= D_hard && d < slopStart) {
                // SLOP ZONE: velocity-only projection, no positional correction
                // Strength ramps from 0 (at slopStart) to 1 (at minDist)
                const slopT = (slopStart - d) / slop;  // 0→1 as d approaches minDist
                const slopRamp = slopT * slopT * (3 - 2 * slopT);  // smoothstep

                // Project inward velocity with ramped strength
                if (!a.isFixed) {
                    const aInward = a.vx * nx + a.vy * ny;
                    if (aInward > 0) {
                        a.vx -= aInward * nx * slopRamp;
                        a.vy -= aInward * ny * slopRamp;
                    }
                }
                if (!b.isFixed) {
                    const bInward = b.vx * nx + b.vy * ny;
                    if (bInward < 0) {
                        b.vx -= bInward * nx * slopRamp;
                        b.vy -= bInward * ny * slopRamp;
                    }
                }
            }
            else if (d < D_hard) {
                // CONTINUOUS BIAS: apply outward velocity, ramped by penetration
                const penetration = D_hard - d;
                const t = Math.min(penetration / D_hard, 1);  // 0→1
                const ramp = t * t * (3 - 2 * t);  // Smoothstep
                const bias = ramp * biasStrength;

                if (!a.isFixed && !b.isFixed) {
                    a.vx -= nx * bias;
                    a.vy -= ny * bias;
                    b.vx += nx * bias;
                    b.vy += ny * bias;
                } else if (!a.isFixed) {
                    a.vx -= nx * bias * 2;
                    a.vy -= ny * bias * 2;
                } else if (!b.isFixed) {
                    b.vx += nx * bias * 2;
                    b.vy += ny * bias * 2;
                }

                // VELOCITY PROJECTION: remove inward component to prevent "invisible wall" bounce
                // n points from a toward b, so:
                // - for a, inward = moving toward b = positive dot with n
                // - for b, inward = moving toward a = negative dot with n
                if (!a.isFixed) {
                    const aInward = a.vx * nx + a.vy * ny;  // positive = moving toward b
                    if (aInward > 0) {
                        a.vx -= aInward * nx;
                        a.vy -= aInward * ny;
                    }
                }
                if (!b.isFixed) {
                    const bInward = b.vx * nx + b.vy * ny;  // negative = moving toward a
                    if (bInward < 0) {
                        b.vx -= bInward * nx;
                        b.vy -= bInward * ny;
                    }
                }

                // SAFETY NET: hard clamp only for deep violations
                // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
                if (penetration > 5) {
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
                        }
                        if (bAccum && bDeg > 1 && !bHubSkip) {
                            bAccum.dx += nx * emergencyCorrection * 0.5;
                            bAccum.dy += ny * emergencyCorrection * 0.5;
                        }
                    } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                        aAccum.dx -= nx * emergencyCorrection;
                        aAccum.dy -= ny * emergencyCorrection;
                    } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                        bAccum.dx += nx * emergencyCorrection;
                        bAccum.dy += ny * emergencyCorrection;
                    }
                }

                engine.clampedPairs.add(pairKey);
            }
            else if (wasClamped && d < releaseDist) {
                // HOLD: inside hysteresis buffer, do nothing
            }
            else {
                // RELEASE: outside buffer, clear lock
                engine.clampedPairs.delete(pairKey);
            }
        }
    }
};
