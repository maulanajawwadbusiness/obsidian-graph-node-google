import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';

export const computeNodeDegrees = (engine: PhysicsEngine, nodeList: PhysicsNode[]) => {
    const nodeDegree = new Map<string, number>();
    for (const node of nodeList) {
        nodeDegree.set(node.id, 0);
    }
    for (const link of engine.links) {
        nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
        nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
    }

    return nodeDegree;
};

export const applyExpansionResistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegree: Map<string, number>,
    energy: number
) => {
    // =====================================================================
    // PHASE-AWARE EXPANSION RESISTANCE (Degree-based velocity damping)
    // High-degree nodes lose momentum gradually during expansion
    // Prevents "hitting invisible wall" - feels like mass increasing
    // =====================================================================
    if (energy > 0.7) {
        const expResist = engine.config.expansionResistance;

        for (const node of nodeList) {
            if (node.isFixed) continue;

            const degree = nodeDegree.get(node.id) || 0;
            if (degree <= 1) continue;  // Only affects multi-connected nodes

            // Normalize degree: (degree-1)/4 → 0..1
            const degNorm = Math.min((degree - 1) / 4, 1);
            // Smoothstep for gradual ramp
            const resistance = degNorm * degNorm * (3 - 2 * degNorm);

            // Apply as velocity damping (not position correction)
            const damp = 1 - resistance * expResist;
            node.vx *= damp;
            node.vy *= damp;
        }
    }
};
