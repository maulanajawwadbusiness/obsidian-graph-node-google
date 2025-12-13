import { PhysicsNode, PhysicsLink, ForceConfig } from './types';

/**
 * Apply repulsion efficiently.
 * UX Anchor: "Cluster" & "Idle Spacing".
 * Nodes should push away from each other.
 */
export function applyRepulsion(
    nodes: PhysicsNode[],
    config: ForceConfig
) {
    const { repulsionStrength, repulsionDistanceMax } = config;
    const maxDistSq = repulsionDistanceMax * repulsionDistanceMax;

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

                // Force formula: F = k / d
                // We can experiment with k / d^2 for stronger close-range repulsion
                // but often 1/d is smoother for graphs. 
                // Let's try: F = strength / d
                const forceMagnitude = repulsionStrength / d;

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
    stiffnessScale: number = 1.0
) {
    const { springStiffness, targetSpacing } = config;

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

        // Hooke's Law: F = k * (current_distance - rest_length)
        // We want the force to act to RESTORE the length.

        // Effective Length = Base (or Override) * Bias
        const baseLen = link.length ?? targetSpacing;
        const effectiveLength = baseLen * (link.lengthBias ?? 1.0);

        const displacement = d - effectiveLength;

        // Effective Stiffness = Base (or Override) * Bias * Global Scale
        const baseK = link.strength ?? springStiffness;
        const effectiveK = baseK * (link.stiffnessBias ?? 1.0) * stiffnessScale;

        const forceMagnitude = effectiveK * displacement;

        // Normalize direction (dx/d, dy/d)
        const fx = (dx / d) * forceMagnitude;
        const fy = (dy / d) * forceMagnitude;

        // Apply
        if (!source.isFixed) {
            source.fx += fx;
            source.fy += fy;
        }
        if (!target.isFixed) {
            target.fx -= fx;
            target.fy -= fy;
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
    const { targetSpacing } = config;

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

        // Target Distance
        const baseLen = link.length ?? targetSpacing;
        const targetLen = baseLen * (link.lengthBias ?? 1.0);

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
