/**
 * Adapter: Convert legacy PhysicsNode/PhysicsLink to Topology format
 */

import type { PhysicsNode, PhysicsLink } from '../physics/types';
import type { Topology, NodeSpec, DirectedLink } from './topologyTypes';

/**
 * Convert a PhysicsNode to a NodeSpec (extract only topology-relevant fields).
 */
export function nodeToSpec(node: PhysicsNode): NodeSpec {
    return {
        id: node.id,
        label: node.label,
        meta: {
            role: node.role,
            // Preserve non-physics metadata if needed
        }
    };
}

/**
 * Convert a PhysicsLink to a DirectedLink.
 * Note: PhysicsLink is currently undirected, so we choose source→target as direction.
 */
export function linkToDirected(link: PhysicsLink): DirectedLink {
    return {
        from: link.source,
        to: link.target,
        kind: 'structural', // Mark as structural (from random generator)
        weight: link.stiffnessBias,
        meta: {
            lengthBias: link.lengthBias,
            stiffnessBias: link.stiffnessBias
        }
    };
}

/**
 * Convert legacy generator output to Topology format.
 */
export function legacyToTopology(nodes: PhysicsNode[], links: PhysicsLink[]): Topology {
    return {
        nodes: nodes.map(nodeToSpec),
        links: links.map(linkToDirected)
    };
}
