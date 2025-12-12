import { PhysicsNode, PhysicsLink, ForceConfig } from './types';

/**
 * Calculates the distance squared between two points.
 * Easier on CPU than distance (no sqrt).
 */
function distSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

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
 * Apply spring force for links.
 * UX Anchor: "Friend-Distance".
 * Pulls connected nodes together or pushes them if too close.
 */
export function applySprings(
    nodes: Map<string, PhysicsNode>,
    links: PhysicsLink[],
    config: ForceConfig
) {
    const { springStiffness, springLength } = config;

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
        const displacement = d - (link.length ?? springLength);
        // If displacement > 0 (too far), force pulls source towards target (positive direction relative to source->target vector)
        // Actually: standard vector from source to target is (dx, dy).
        // If d > rest, we want force to pull source TOWARD target.
        // So force vector on source should be aligned with (dx, dy).

        const k = link.strength ?? springStiffness;
        const forceMagnitude = k * displacement;

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
 * Apply center gravity.
 * UX Anchor: "Center-of-Mass".
 * Keeps everything from drifting to infinity.
 */
export function applyCenterGravity(
    nodes: PhysicsNode[],
    config: ForceConfig,
    center: { x: number, y: number } = { x: 0, y: 0 }
) {
    const { gravityCenterStrength } = config;

    for (const node of nodes) {
        if (node.isFixed) continue;

        // Pull toward center
        const dx = center.x - node.x;
        const dy = center.y - node.y;

        node.fx += dx * gravityCenterStrength;
        node.fy += dy * gravityCenterStrength;
    }
}
