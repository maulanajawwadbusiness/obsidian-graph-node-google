/**
 * KGSpec to Topology Conversion
 *
 * Pure conversion utilities (no side effects).
 */

import type { KGNode, KGLink, KGSpec } from './kgSpec';
import type { Topology, DirectedLink, NodeSpec } from './topologyTypes';

/**
 * Convert KGNode to NodeSpec.
 */
function kgNodeToNodeSpec(node: KGNode): NodeSpec {
    return {
        id: node.id,
        label: node.label || node.id,
        meta: {
            kind: node.kind,
            source: node.source,
            payload: node.payload
        }
    };
}

/**
 * Convert KGLink to DirectedLink.
 */
function kgLinkToDirectedLink(link: KGLink): DirectedLink {
    return {
        from: link.from,
        to: link.to,
        kind: link.rel || 'relates',
        weight: link.weight ?? 1.0,
        meta: {
            directed: link.directed !== false,
            ...link.meta
        }
    };
}

/**
 * Convert KGSpec to Topology.
 *
 * This is a pure function - does not mutate global state.
 * Caller should validate spec first.
 *
 * @param spec The KGSpec to convert
 * @returns Topology object
 */
export function toTopologyFromKGSpec(spec: KGSpec): Topology {
    const topology: Topology = {
        nodes: spec.nodes.map(kgNodeToNodeSpec),
        links: spec.links.map(kgLinkToDirectedLink)
    };

    return topology;
}
