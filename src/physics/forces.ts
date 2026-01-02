import { PhysicsNode, PhysicsLink, ForceConfig } from './types';

/**
 * Apply repulsion efficiently.
 * UX Anchor: "Cluster" & "Idle Spacing".
 * Nodes should push away from each other.
 */
export function applyRepulsion(
    nodes: PhysicsNode[],
    config: ForceConfig,
    energy?: number
) {
    const { repulsionStrength, repulsionDistanceMax } = config;
    const maxDistSq = repulsionDistanceMax * repulsionDistanceMax;

    // DENSITY-DEPENDENT REPULSION (early expansion only)
    // Nodes in dense regions experience stronger repulsion
    // Creates "center has higher potential" without explicit centroid
    const earlyExpansion = energy !== undefined && energy > 0.85;
    const densityRadius = 25;  // Radius to count neighbors
    const localDensity = new Map<string, number>();

    if (earlyExpansion) {
        for (const node of nodes) {
            let count = 0;
            for (const other of nodes) {
                if (other.id === node.id) continue;
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < densityRadius) count++;
            }
            localDensity.set(node.id, count);
        }
    }

    // DEBUG: track stats for first 20 frames
    let debugMaxDensityBoost = 1.0;
    let debugAvgCenterDensity = 0;
    let debugCenterCount = 0;

    for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j];

            let dx = nodeA.x - nodeB.x;
            let dy = nodeA.y - nodeB.y;

            // If nodes are exactly on top of each other, nudge slightly random
            if (dx === 0 && dy === 0) {
                dx = (Math.random() - 0.5) * 0.1;
                dy = (Math.random() - 0.5) * 0.1;
            }

            const d2 = dx * dx + dy * dy;

            if (d2 < maxDistSq && d2 > 0) {
                const d = Math.sqrt(d2);

                // REPULSION DEAD-CORE: within coreRadius, scale repulsion down
                // Creates pressure gradient instead of uniform radial blast
                // Allows close nodes to slide past each other before spacing locks
                const coreRadius = 12;  // Very close proximity threshold
                let repulsionScale = 1.0;
                if (d < coreRadius) {
                    // Ramp: 0.1 at d=0, 1.0 at d=coreRadius (smoothstep)
                    const t = d / coreRadius;  // 0 at center, 1 at edge
                    const smooth = t * t * (3 - 2 * t);
                    repulsionScale = 0.1 + smooth * 0.9;  // 10% → 100%
                }

                // ENHANCED DENSITY BOOST: stronger at short range
                // Nodes in dense regions AND close together repel much more strongly
                let densityBoost = 1.0;
                if (earlyExpansion) {
                    const densityA = localDensity.get(nodeA.id) || 0;
                    const densityB = localDensity.get(nodeB.id) || 0;
                    const avgDensity = (densityA + densityB) / 2;

                    // Track center-ish nodes (high density)
                    if (densityA >= 4) { debugAvgCenterDensity += densityA; debugCenterCount++; }
                    if (densityB >= 4) { debugAvgCenterDensity += densityB; debugCenterCount++; }

                    if (avgDensity > 2) {
                        // Base density boost: +30% per extra neighbor beyond 2
                        const baseDensityBoost = 0.30 * (avgDensity - 2);

                        // Distance multiplier: stronger when very close (within minNodeDistance)
                        const minDist = config.minNodeDistance || 30;
                        let distanceMultiplier = 1.0;
                        if (d < minDist) {
                            // Ramp: 2.0 at d=0.5*minDist, 1.0 at d=minDist (smoothstep)
                            const closeT = Math.max(0, (minDist - d) / (minDist * 0.5));
                            const closeSmooth = Math.min(closeT, 1);
                            distanceMultiplier = 1.0 + closeSmooth;  // 1.0 → 2.0
                        }

                        densityBoost = 1 + baseDensityBoost * distanceMultiplier;

                        // Clamp to prevent explosion (max 3x)
                        densityBoost = Math.min(densityBoost, 3.0);

                        debugMaxDensityBoost = Math.max(debugMaxDensityBoost, densityBoost);
                    }
                }

                // Standard repulsion force: F = k / d, scaled by dead-core and density
                const forceMagnitude = (repulsionStrength / d) * repulsionScale * densityBoost;

                // Vector components
                const fx = (dx / d) * forceMagnitude;
                const fy = (dy / d) * forceMagnitude;

                if (!nodeA.isFixed) {
                    nodeA.fx += fx;
                    nodeA.fy += fy;
                }
                if (!nodeB.isFixed) {
                    nodeB.fx -= fx;
                    nodeB.fy -= fy;
                }
            }
        }
    }

    // DEBUG: log for first 20 frames (use global counter via config hack)
    if (earlyExpansion && debugCenterCount > 0) {
        const avgDensity = debugAvgCenterDensity / debugCenterCount;
        console.log(`[Repulsion] avgCenterDensity: ${avgDensity.toFixed(1)}, maxDensityBoost: ${debugMaxDensityBoost.toFixed(2)}`);
    }
}

/**
 * Apply hard collision/personal space.
 * UX Anchor: "Visual Dignity".
 * Prevents overlap. Acts as a hard shell with padding.
 */
export function applyCollision(
    nodes: PhysicsNode[],
    config: ForceConfig,
    strengthScale: number = 1.0
) {
    const { collisionStrength, collisionPadding } = config;
    // Effective strength
    const strength = collisionStrength * strengthScale;
    if (strength <= 0.01) return; // Optimization: Skip if minimal

    for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j];

            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const distSq = dx * dx + dy * dy;

            const radiusSum = nodeA.radius + nodeB.radius + collisionPadding;
            const minDistSq = radiusSum * radiusSum;

            if (distSq < minDistSq && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = radiusSum - dist;

                // Force is proportional to overlap (Penalty Method)
                // Or we could use strength / distance, but overlap is more "solid".
                // User wants "force strength increases sharply as distance approaches zero".
                // Overlap is linear, but we can make it exponential or just very strong.
                // k * overlap is standard spring collision.
                const forceMagnitude = overlap * strength;

                const nx = dx / dist;
                const ny = dy / dist;

                const fx = nx * forceMagnitude;
                const fy = ny * forceMagnitude;

                if (!nodeA.isFixed) {
                    nodeA.fx += fx;
                    nodeA.fy += fy;
                }
                if (!nodeB.isFixed) {
                    nodeB.fx -= fx;
                    nodeB.fy -= fy;
                }
            } else if (distSq === 0) {
                // Exact overlap? Push apart randomly.
                const angle = Math.random() * Math.PI * 2;
                const force = collisionStrength * 0.1;
                if (!nodeA.isFixed) { nodeA.fx += Math.cos(angle) * force; nodeA.fy += Math.sin(angle) * force; }
                if (!nodeB.isFixed) { nodeB.fx -= Math.cos(angle) * force; nodeB.fy -= Math.sin(angle) * force; }
            }
        }
    }
}

/**
 * Apply spring force for links.
 * UX Anchor: "Friend-Distance".
 * Pulls connected nodes together or pushes them if too close.
 */
export function applySprings(
    nodes: Map<string, PhysicsNode>,
    links: PhysicsLink[],
    config: ForceConfig,
    stiffnessScale: number = 1.0,
    energy: number = 0.0  // For early-phase hub softening
) {
    const { springStiffness } = config;

    // Precompute node degrees for hub softening
    const nodeDegree = new Map<string, number>();
    for (const [id] of nodes) {
        nodeDegree.set(id, 0);
    }
    for (const link of links) {
        nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
        nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
    }

    for (const link of links) {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        if (!source || !target) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;

        // Avoid zero div
        if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) * 0.1;
            dy = (Math.random() - 0.5) * 0.1;
        }

        const d = Math.sqrt(dx * dx + dy * dy);

        // Soft spring with dead zone
        // No force within ±deadZone of rest length (perceptual uniformity)
        const restLength = config.linkRestLength;

        // EARLY-EXPANSION DEAD-ZONE BYPASS for high-degree nodes
        // Temporarily disable dead-zone for hubs to break symmetric equilibrium
        const sourceDeg = nodeDegree.get(link.source) || 0;
        const targetDeg = nodeDegree.get(link.target) || 0;
        const sourceIsHub = sourceDeg >= 3;
        const targetIsHub = targetDeg >= 3;
        const earlyExpansion = energy > 0.8;

        // Dead-zone is 0 for hubs during early expansion, normal otherwise
        const sourceDeadZone = (sourceIsHub && earlyExpansion) ? 0 : restLength * config.springDeadZone;
        const targetDeadZone = (targetIsHub && earlyExpansion) ? 0 : restLength * config.springDeadZone;

        // Use the minimum dead-zone (if either end is a hub, bypass applies to the link)
        const deadZone = Math.min(sourceDeadZone, targetDeadZone);

        const rawDisplacement = d - restLength;

        // Apply dead zone: only apply force outside the band
        let displacement = 0;
        if (rawDisplacement > deadZone) {
            displacement = rawDisplacement - deadZone;  // Stretched beyond band
        } else if (rawDisplacement < -deadZone) {
            displacement = rawDisplacement + deadZone;  // Compressed beyond band
        }
        // else: within dead zone, displacement = 0, no force

        // Effective Stiffness = Base (or Override) * Bias * Global Scale
        const baseK = link.strength ?? springStiffness;
        let effectiveK = baseK * (link.stiffnessBias ?? 1.0) * stiffnessScale;

        // Spring stiffness is now constant (ramping removed)

        const forceMagnitude = effectiveK * displacement;

        // Normalize direction (dx/d, dy/d)
        const fx = (dx / d) * forceMagnitude;
        const fy = (dy / d) * forceMagnitude;

        // EARLY-PHASE HUB SPRING SOFTENING (More aggressive topology softening)
        // During early expansion, reduce spring force for high-degree nodes
        // Allows hubs to drift and break symmetric equilibrium
        const computeHubScale = (nodeId: string): number => {
            if (energy <= 0.5) return 1.0;  // Full spring authority (extended range)

            const deg = nodeDegree.get(nodeId) || 0;
            if (deg < 2) return 1.0;  // Only single nodes unaffected

            // Hub factor: starts at deg=2, peaks at deg=5+
            const hubFactor = Math.min((deg - 1) / 4, 1);

            // Softening: 0.15 at energy=1.0, lerp to 1.0 at energy=0.5
            const minScale = 0.15;  // More aggressive softening
            const energyFade = Math.min((energy - 0.5) / 0.5, 1);  // 0 at 0.5, 1 at 1.0
            const softening = 1.0 - hubFactor * (1.0 - minScale) * energyFade;

            return softening;
        };

        const sourceScale = computeHubScale(link.source);
        const targetScale = computeHubScale(link.target);

        // TANGENTIAL SOFTENING IN DENSE CORES (early expansion only)
        // Allows nodes to shear/rotate relative to neighbors
        // Dense core "melts" via internal rearrangement, not explosion
        // NOW: smooth ramp based on density AND compression ratio
        const applyTangentialSoftening = energy > 0.85;

        // DEBUG: track min tangent scale
        let debugMinTangentScale = 1.0;

        // Compute local density for source and target
        let sourceDensity = 0, targetDensity = 0;
        if (applyTangentialSoftening) {
            const densityRadius = 30;
            for (const [, other] of nodes) {
                if (other.id !== source.id) {
                    const ddx = other.x - source.x;
                    const ddy = other.y - source.y;
                    if (Math.sqrt(ddx * ddx + ddy * ddy) < densityRadius) sourceDensity++;
                }
                if (other.id !== target.id) {
                    const ddx = other.x - target.x;
                    const ddy = other.y - target.y;
                    if (Math.sqrt(ddx * ddx + ddy * ddy) < densityRadius) targetDensity++;
                }
            }
        }

        // Compute smooth tangent scale based on density AND compression
        const computeTangentScale = (density: number, springDist: number, restLength: number): number => {
            if (!applyTangentialSoftening) return 1.0;

            // Density ramp: smoothstep from d0=2 to d1=6
            const d0 = 2, d1 = 6;
            const densityT = Math.min(Math.max((density - d0) / (d1 - d0), 0), 1);
            const densitySmooth = densityT * densityT * (3 - 2 * densityT);  // smoothstep

            // Compression ramp: stronger softening when spring is compressed
            // 1.0 at dist/rest >= 1.0, 1.5 at dist/rest <= 0.5
            const compressionRatio = Math.min(springDist / restLength, 1);
            const compressionBoost = 1 + (1 - compressionRatio) * 0.5;  // 1.0 → 1.5

            // Combined: scale from 1.0 (no softening) to 0.05 (max softening)
            const minTangent = 0.05;
            const tangentScale = 1.0 - densitySmooth * compressionBoost * (1.0 - minTangent);

            return Math.max(tangentScale, minTangent);
        };

        // Apply with hub softening (and tangential softening for dense regions)
        if (!source.isFixed) {
            let sfx = fx * sourceScale;
            let sfy = fy * sourceScale;

            // Tangential softening: decompose and reduce tangential component
            const sourceTangentScale = computeTangentScale(sourceDensity, d, restLength);
            if (sourceTangentScale < 1.0) {
                // Unit vector along spring
                const ux = dx / d;
                const uy = dy / d;

                // Radial component (along spring direction)
                const radialMag = sfx * ux + sfy * uy;
                const radialFx = radialMag * ux;
                const radialFy = radialMag * uy;

                // Tangential component (perpendicular)
                const tangentFx = sfx - radialFx;
                const tangentFy = sfy - radialFy;

                // Recombine with softened tangential
                sfx = radialFx + tangentFx * sourceTangentScale;
                sfy = radialFy + tangentFy * sourceTangentScale;

                debugMinTangentScale = Math.min(debugMinTangentScale, sourceTangentScale);
            }

            source.fx += sfx;
            source.fy += sfy;
        }
        if (!target.isFixed) {
            let tfx = -fx * targetScale;
            let tfy = -fy * targetScale;

            // Tangential softening for target
            const targetTangentScale = computeTangentScale(targetDensity, d, restLength);
            if (targetTangentScale < 1.0) {
                const ux = dx / d;
                const uy = dy / d;

                const radialMag = tfx * ux + tfy * uy;
                const radialFx = radialMag * ux;
                const radialFy = radialMag * uy;

                const tangentFx = tfx - radialFx;
                const tangentFy = tfy - radialFy;

                tfx = radialFx + tangentFx * targetTangentScale;
                tfy = radialFy + tangentFy * targetTangentScale;

                debugMinTangentScale = Math.min(debugMinTangentScale, targetTangentScale);
            }

            target.fx += tfx;
            target.fy += tfy;
        }

        // DEBUG: log min tangent scale
        if (applyTangentialSoftening && debugMinTangentScale < 1.0) {
            console.log(`[Springs] minTangentScale: ${debugMinTangentScale.toFixed(3)}, srcDensity: ${sourceDensity}, tgtDensity: ${targetDensity}`);
        }
    }
}

/**
 * PBD (Position Based Dynamics) Constraint for Snap Phase.
         * Directly projects nodes to their target distance.
         * This ignores mass and inertia, strictly enforcing geometry.
         */
export function applySpringConstraint(
    nodes: Map<string, PhysicsNode>,
    links: PhysicsLink[],
    config: ForceConfig,
    strength: number = 0.5 // How much of the error to correct per frame (0.0 - 1.0)
) {

    for (const link of links) {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;

        // Zero shim
        if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) * 0.1;
            dy = (Math.random() - 0.5) * 0.1;
        }

        const d = Math.sqrt(dx * dx + dy * dy);

        // Uniform rest length for all springs
        const targetLen = config.linkRestLength;

        // Difference
        const diff = d - targetLen;

        // PBD Correction vector
        // We want to move them closer/further by `diff`.
        // Fraction to move per node:
        const correction = diff * strength;

        // Normalize
        const ndx = dx / d;
        const ndy = dy / d;

        // Move amount
        // If both free: split 50/50. If one fixed: move other 100%.
        let wS = source.isFixed ? 0 : 0.5;
        let wT = target.isFixed ? 0 : 0.5;

        // Rescale if one is fixed
        if (wS === 0 && wT === 0.5) wT = 1.0;
        if (wT === 0 && wS === 0.5) wS = 1.0;

        // Apply Position Shift immediately
        if (wS > 0) {
            source.x += ndx * correction * wS;
            source.y += ndy * correction * wS;
        }
        if (wT > 0) {
            target.x -= ndx * correction * wT;
            target.y -= ndy * correction * wT;
        }
    }
}

/**
 * Apply center gravity.
 * UX Anchor: "Center-of-Mass".
 * Keeps everything from drifting to infinity.
 */
export function applyCenterGravity(
    nodes: PhysicsNode[],
    config: ForceConfig,
    center: { x: number, y: number } = { x: 0, y: 0 }
) {
    const { gravityCenterStrength, gravityBaseRadius } = config;
    if (nodes.length === 0) return;

    // UX Anchor: "Organism Sizing"
    // Calculate dynamic "safe radius" based on population.
    // 20 nodes -> ~4.5 * base -> base should be small (~30).
    // Let's use: base + (sqrt(N) * spacingFactor)
    // Or simpler: base * log(N+1)
    // User wants: 20 nodes -> small. 400 nodes -> fits screen.
    // Let's try: Radius = base + (N * 2) 
    const populationRadius = gravityBaseRadius + (nodes.length * 3);

    // UX Anchor: "Elliptical Comfort" (Aspect Ratio)
    // We want to squeeze vertically more than horizontally.
    // We can do this by scaling Y distance higher than X distance before checking against radius.
    // effectively making the safe zone an ellipse (wider than tall).
    const verticalPenalty = 2.5; // Y axis is 2.5x more "expensive"

    for (const node of nodes) {
        if (node.isFixed) continue;

        const dx = center.x - node.x;
        const dy = center.y - node.y;

        // Elliptical distance metric
        // We stretch dy effectively.
        const effectiveDist = Math.sqrt(dx * dx + (dy * verticalPenalty) * (dy * verticalPenalty));

        if (effectiveDist > populationRadius) {
            const distOutside = effectiveDist - populationRadius;

            // Direction TO center
            const d = Math.sqrt(dx * dx + dy * dy); // True geometric distance for normalization
            const nx = dx / d;
            const ny = dy / d;

            // Force
            const force = distOutside * gravityCenterStrength;

            node.fx += nx * force;
            node.fy += ny * force;
        }
    }
}

/**
 * Apply soft boundary force.
 * UX Anchor: "Screen Containment".
 * Pushes nodes back if they get too close to the world bounds.
 * Forces are zero if > margin away. Ramps up linearly as they approach/cross edge.
 */
export function applyBoundaryForce(
    nodes: PhysicsNode[],
    config: ForceConfig,
    worldWidth: number,
    worldHeight: number
) {
    const { boundaryMargin, boundaryStrength } = config;
    const halfW = worldWidth / 2;
    const halfH = worldHeight / 2;

    const minX = -halfW + boundaryMargin;
    const maxX = halfW - boundaryMargin;
    const minY = -halfH + boundaryMargin;
    const maxY = halfH - boundaryMargin;

    // We assume world is centered at 0,0
    for (const node of nodes) {
        if (node.isFixed) continue;

        // Check Left
        if (node.x < minX) {
            // Distance into the margin or past it
            const penetration = minX - node.x;
            // Normalized 0..1 (if we used margin as scale) but simplest is direct force * penetration
            // Force points RIGHT (positive)
            node.fx += penetration * boundaryStrength * 0.01;
        }

        // Check Right
        if (node.x > maxX) {
            const penetration = node.x - maxX;
            // Force points LEFT (negative)
            node.fx -= penetration * boundaryStrength * 0.01;
        }

        // Check Top
        if (node.y < minY) {
            const penetration = minY - node.y;
            // Force points DOWN (positive)
            node.fy += penetration * boundaryStrength * 0.01;
        }

        // Check Bottom
        if (node.y > maxY) {
            const penetration = node.y - maxY;
            // Force points UP (negative)
            node.fy -= penetration * boundaryStrength * 0.01;
        }
    }
}
