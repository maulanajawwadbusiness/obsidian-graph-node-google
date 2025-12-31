import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';

export const applyDragVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    stats: DebugStats
) => {
    if (!engine.draggedNodeId || !engine.dragTarget) return;

    const node = engine.nodes.get(engine.draggedNodeId);
    if (!node) return;

    const dx = engine.dragTarget.x - node.x;
    const dy = engine.dragTarget.y - node.y;

    const dvx = dx * 2.0 * dt;
    const dvy = dy * 2.0 * dt;

    if (!node.isFixed) {
        node.vx += dvx;
        node.vy += dvy;
    }

    const passStats = getPassStats(stats, 'DragVelocity');
    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
    if (deltaMag > 0) {
        passStats.velocity += deltaMag;
        passStats.nodes += 1;
    }
};

export const applyPreRollVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    preRollActive: boolean,
    stats: DebugStats
) => {
    if (!preRollActive) return;

    const passStats = getPassStats(stats, 'PreRollVelocity');
    const affected = new Set<string>();

    // Apply spacing repulsion between all pairs
    const minDist = engine.config.minNodeDistance;
    for (let i = 0; i < nodeList.length; i++) {
        const a = nodeList[i];
        for (let j = i + 1; j < nodeList.length; j++) {
            const b = nodeList[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < minDist && d > 0.1) {
                const overlap = minDist - d;
                const nx = dx / d;
                const ny = dy / d;

                // Apply as velocity, not position
                const strength = overlap * 2.0;  // Moderate push
                let deltaMag = 0;

                if (!a.isFixed) {
                    const dvx = -nx * strength;
                    const dvy = -ny * strength;
                    a.vx += dvx;
                    a.vy += dvy;
                    deltaMag += Math.sqrt(dvx * dvx + dvy * dvy);
                    affected.add(a.id);
                }
                if (!b.isFixed) {
                    const dvx = nx * strength;
                    const dvy = ny * strength;
                    b.vx += dvx;
                    b.vy += dvy;
                    deltaMag += Math.sqrt(dvx * dvx + dvy * dvy);
                    affected.add(b.id);
                }

                passStats.velocity += deltaMag;
            }
        }
    }

    // Compute centroid for carrier rotation
    let cx = 0, cy = 0;
    for (const node of nodeList) {
        cx += node.x;
        cy += node.y;
    }
    cx /= nodeList.length;
    cy /= nodeList.length;

    // MICRO CARRIER DRIFT: Prevent crystallization into eigenvector directions
    // Adds shared rotational motion so separation feels like drifting water
    // Fades out from frame 5 → 0
    const carrierOmega = 0.03;  // rad/frame, ~1.8 rad/s at 60fps
    const fade = engine.preRollFrames / 5;  // 1.0 at frame 5, 0.2 at frame 1
    const effectiveOmega = carrierOmega * fade;

    // Apply carrier rotation to velocities (rotate velocity frame around centroid)
    for (const node of nodeList) {
        if (node.isFixed) continue;

        // Position relative to centroid
        const rx = node.x - cx;
        const ry = node.y - cy;

        // Tangential velocity from rotation
        const tangentX = -ry * effectiveOmega;
        const tangentY = rx * effectiveOmega;

        node.vx += tangentX;
        node.vy += tangentY;

        const deltaMag = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;
};

export const applyCarrierFlowAndPersistence = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    node: PhysicsNode,
    energy: number,
    stats: DebugStats
) => {
    if (energy <= 0.7) return;

    const passStats = getPassStats(stats, 'CarrierFlow');
    let nodeVelocityDelta = 0;

    // Count degree inline
    let deg = 0;
    for (const link of engine.links) {
        if (link.source === node.id || link.target === node.id) deg++;
    }

    if (deg >= 3) {
        // TRAPPED HUB CARRIER FLOW
        // Detect trapped hub: low net force AND low velocity
        const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
        const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const forceEpsilon = 1.0;
        const velocityThreshold = 0.5;

        const isTrapped = fMag < forceEpsilon && vMag < velocityThreshold;

        if (isTrapped) {
            // Compute local cluster centroid (nearby hub nodes)
            let clusterCx = 0, clusterCy = 0;
            let clusterCount = 0;

            for (const otherNode of nodeList) {
                if (otherNode.id === node.id) continue;
                const dx = otherNode.x - node.x;
                const dy = otherNode.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Only nearby nodes (within 2x minNodeDistance)
                if (dist < engine.config.minNodeDistance * 2) {
                    clusterCx += otherNode.x;
                    clusterCy += otherNode.y;
                    clusterCount++;
                }
            }

            if (clusterCount > 0) {
                clusterCx /= clusterCount;
                clusterCy /= clusterCount;

                // Direction from centroid to node
                const toCx = node.x - clusterCx;
                const toCy = node.y - clusterCy;
                const toD = Math.sqrt(toCx * toCx + toCy * toCy);

                if (toD > 0.1) {
                    // Perpendicular direction (tangent to centroid)
                    const perpX = -toCy / toD;
                    const perpY = toCx / toD;

                    // Fade: 1.0 at energy=1.0, 0.0 at energy=0.7
                    const fade = Math.min((energy - 0.7) / 0.3, 1);
                    const smoothFade = fade * fade * (3 - 2 * fade);

                    // Very small velocity bias
                    const carrierStrength = 0.05 * smoothFade;

                    node.vx += perpX * carrierStrength;
                    node.vy += perpY * carrierStrength;
                    nodeVelocityDelta += Math.abs(carrierStrength);

                    // RELIABILITY GATE: only store direction if well-defined
                    const centroidEpsilon = 2.0;  // Minimum centroid distance
                    const forceEpsilon = 0.5;     // Minimum net force
                    const directionReliable = toD > centroidEpsilon || fMag > forceEpsilon;

                    if (directionReliable) {
                        // STORE CARRIER DIRECTION for directional persistence
                        engine.carrierDir.set(node.id, { x: perpX, y: perpY });
                        engine.carrierTimer.set(node.id, 20);  // ~330ms at 60fps
                    } else {
                        // Direction ill-defined - HARD DISABLE persistence
                        engine.carrierDir.delete(node.id);
                        engine.carrierTimer.delete(node.id);
                    }
                } else {
                    // Too close to centroid - disable persistence
                    engine.carrierDir.delete(node.id);
                    engine.carrierTimer.delete(node.id);
                }
            }
        }
    }

    // DIRECTIONAL PERSISTENCE: filter spring forces that oppose carrier direction
    const cDir = engine.carrierDir.get(node.id);
    const cTimer = engine.carrierTimer.get(node.id) || 0;

    if (cDir && cTimer > 0) {
        // Decrement timer
        engine.carrierTimer.set(node.id, cTimer - 1);

        // Check if velocity exceeds threshold (symmetry broken, persistence no longer needed)
        const vMagNow = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (vMagNow > 3.0) {
            // Clear persistence
            engine.carrierDir.delete(node.id);
            engine.carrierTimer.delete(node.id);
        } else {
            // Filter spring force: project out component opposing carrier direction
            const fDotC = node.fx * cDir.x + node.fy * cDir.y;
            if (fDotC < 0) {
                // Force opposes carrier direction - remove opposing component
                const filterStrength = 0.7;  // How much to filter (1.0 = complete)
                const beforeFx = node.fx;
                const beforeFy = node.fy;
                node.fx -= fDotC * cDir.x * filterStrength;
                node.fy -= fDotC * cDir.y * filterStrength;

                const dFx = node.fx - beforeFx;
                const dFy = node.fy - beforeFy;
                passStats.force += Math.sqrt(dFx * dFx + dFy * dFy);
            }
        }
    } else if (cTimer <= 0 && cDir) {
        // Timer expired, clear carrier direction
        engine.carrierDir.delete(node.id);
        engine.carrierTimer.delete(node.id);
    }

    if (nodeVelocityDelta > 0) {
        passStats.velocity += nodeVelocityDelta;
        passStats.nodes += 1;
    }
};

export const applyHubVelocityScaling = (
    engine: PhysicsEngine,
    node: PhysicsNode,
    stats: DebugStats
) => {
    let nodeDeg = 0;
    for (const link of engine.links) {
        if (link.source === node.id || link.target === node.id) nodeDeg++;
    }
    if (nodeDeg > 2) {
        const hubFactor = Math.min((nodeDeg - 2) / 4, 1);
        const hubVelocityScale = 0.7;  // How slow hubs respond
        const velScale = 1.0 - hubFactor * (1.0 - hubVelocityScale);

        const beforeVx = node.vx;
        const beforeVy = node.vy;
        node.vx *= velScale;
        node.vy *= velScale;

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            const passStats = getPassStats(stats, 'HubVelocityScaling');
            passStats.velocity += deltaMag;
            passStats.nodes += 1;
        }
    }
};

export const applyExpansionResistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegree: Map<string, number>,
    energy: number,
    stats: DebugStats
) => {
    if (energy <= 0.7) return;

    const passStats = getPassStats(stats, 'ExpansionResistance');
    const affected = new Set<string>();
    const expResist = engine.config.expansionResistance;

    for (const node of nodeList) {
        if (node.isFixed) continue;

        const degree = nodeDegree.get(node.id) || 0;
        if (degree <= 1) continue;  // Only affects multi-connected nodes

        // Normalize degree: (degree-1)/4 → 0..1
        const degNorm = Math.min((degree - 1) / 4, 1);
        // Smoothstep for gradual ramp
        const resistance = degNorm * degNorm * (3 - 2 * degNorm);

        const beforeVx = node.vx;
        const beforeVy = node.vy;

        // Apply as velocity damping (not position correction)
        const damp = 1 - resistance * expResist;
        node.vx *= damp;
        node.vy *= damp;

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;
};

export const applyAngleResistanceVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    stats: DebugStats
) => {
    const passStats = getPassStats(stats, 'AngleResistance');
    const affected = new Set<string>();

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

                const beforeVx = nb.vx;
                const beforeVy = nb.vy;

                nb.vx += tangentX * force;
                nb.vy += tangentY * force;

                // Apply local damping in emergency/forbidden zones
                if (localDamping < 1.0) {
                    nb.vx *= localDamping;
                    nb.vy *= localDamping;
                }

                const dvx = nb.vx - beforeVx;
                const dvy = nb.vy - beforeVy;
                const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                if (deltaMag > 0) {
                    passStats.velocity += deltaMag;
                    affected.add(nb.id);
                }
            };

            applyTangentialForce(currNb, curr, -1);  // Clockwise
            applyTangentialForce(nextNb, next, 1);   // Counter-clockwise
        }
    }

    passStats.nodes += affected.size;
};

export const applyDistanceBiasVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    stats: DebugStats
) => {
    const passStats = getPassStats(stats, 'DistanceBiasVelocity');
    const affected = new Set<string>();

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
                    const beforeVx = a.vx;
                    const beforeVy = a.vy;
                    const aInward = a.vx * nx + a.vy * ny;
                    if (aInward > 0) {
                        a.vx -= aInward * nx * slopRamp;
                        a.vy -= aInward * ny * slopRamp;
                    }
                    const dvx = a.vx - beforeVx;
                    const dvy = a.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(a.id);
                    }
                }
                if (!b.isFixed) {
                    const beforeVx = b.vx;
                    const beforeVy = b.vy;
                    const bInward = b.vx * nx + b.vy * ny;
                    if (bInward < 0) {
                        b.vx -= bInward * nx * slopRamp;
                        b.vy -= bInward * ny * slopRamp;
                    }
                    const dvx = b.vx - beforeVx;
                    const dvy = b.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(b.id);
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
                    const dvxA = -nx * bias;
                    const dvyA = -ny * bias;
                    const dvxB = nx * bias;
                    const dvyB = ny * bias;
                    a.vx += dvxA;
                    a.vy += dvyA;
                    b.vx += dvxB;
                    b.vy += dvyB;
                    passStats.velocity += Math.sqrt(dvxA * dvxA + dvyA * dvyA);
                    passStats.velocity += Math.sqrt(dvxB * dvxB + dvyB * dvyB);
                    affected.add(a.id);
                    affected.add(b.id);
                } else if (!a.isFixed) {
                    const dvxA = -nx * bias * 2;
                    const dvyA = -ny * bias * 2;
                    a.vx += dvxA;
                    a.vy += dvyA;
                    passStats.velocity += Math.sqrt(dvxA * dvxA + dvyA * dvyA);
                    affected.add(a.id);
                } else if (!b.isFixed) {
                    const dvxB = nx * bias * 2;
                    const dvyB = ny * bias * 2;
                    b.vx += dvxB;
                    b.vy += dvyB;
                    passStats.velocity += Math.sqrt(dvxB * dvxB + dvyB * dvyB);
                    affected.add(b.id);
                }

                // VELOCITY PROJECTION: remove inward component to prevent "invisible wall" bounce
                // n points from a toward b, so:
                // - for a, inward = moving toward b = positive dot with n
                // - for b, inward = moving toward a = negative dot with n
                if (!a.isFixed) {
                    const beforeVx = a.vx;
                    const beforeVy = a.vy;
                    const aInward = a.vx * nx + a.vy * ny;  // positive = moving toward b
                    if (aInward > 0) {
                        a.vx -= aInward * nx;
                        a.vy -= aInward * ny;
                    }
                    const dvx = a.vx - beforeVx;
                    const dvy = a.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(a.id);
                    }
                }
                if (!b.isFixed) {
                    const beforeVx = b.vx;
                    const beforeVy = b.vy;
                    const bInward = b.vx * nx + b.vy * ny;  // negative = moving toward a
                    if (bInward < 0) {
                        b.vx -= bInward * nx;
                        b.vy -= bInward * ny;
                    }
                    const dvx = b.vx - beforeVx;
                    const dvy = b.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(b.id);
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

    passStats.nodes += affected.size;
};
