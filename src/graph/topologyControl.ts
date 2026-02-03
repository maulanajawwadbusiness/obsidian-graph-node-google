/**
 * Topology Control API
 * 
 * Single source of truth for graph topology (nodes + directed links).
 * Enforces immutability and provides centralized mutation.
 */

import type { Topology, DirectedLink, NodeSpec } from './topologyTypes';

/**
 * Internal state (private to this module)
 */
let currentTopology: Topology = {
    nodes: [],
    links: []
};

let topologyVersion = 0;

/**
 * Set the entire topology (replaces current state).
 * Creates a defensive copy to prevent external mutation.
 */
export function setTopology(topology: Topology): void {
    currentTopology = {
        nodes: [...topology.nodes],
        links: [...topology.links]
    };
    topologyVersion++;
    console.log(`[TopologyControl] setTopology: ${currentTopology.nodes.length} nodes, ${currentTopology.links.length} links (v${topologyVersion})`);
}

/**
 * Get the current topology (returns a copy to prevent mutation).
 */
export function getTopology(): Topology {
    return {
        nodes: [...currentTopology.nodes],
        links: [...currentTopology.links]
    };
}

/**
 * Get the current topology version.
 * Increments on any mutation (set/patch/clear).
 */
export function getTopologyVersion(): number {
    return topologyVersion;
}

/**
 * Clear the topology (remove all nodes and links).
 */
export function clearTopology(): void {
    currentTopology = {
        nodes: [],
        links: []
    };
    topologyVersion++;
    console.log(`[TopologyControl] clearTopology (v${topologyVersion})`);
}

/**
 * Patch options for incremental topology updates.
 */
export interface TopologyPatch {
    addNodes?: NodeSpec[];
    removeNodes?: string[]; // Node IDs to remove
    addLinks?: DirectedLink[];
    removeLinks?: Array<{ from: string; to: string }>; // Link endpoints to remove
    setLinks?: DirectedLink[]; // Replace all links (keep nodes)
}

/**
 * Apply an incremental patch to the topology.
 * More efficient than setTopology for small changes.
 */
export function patchTopology(patch: TopologyPatch): void {
    const before = {
        nodes: currentTopology.nodes.length,
        links: currentTopology.links.length
    };

    // Remove nodes
    if (patch.removeNodes && patch.removeNodes.length > 0) {
        const removeSet = new Set(patch.removeNodes);
        currentTopology.nodes = currentTopology.nodes.filter(n => !removeSet.has(n.id));
        // Also remove any links referencing removed nodes
        currentTopology.links = currentTopology.links.filter(
            l => !removeSet.has(l.from) && !removeSet.has(l.to)
        );
    }

    // Add nodes
    if (patch.addNodes && patch.addNodes.length > 0) {
        currentTopology.nodes.push(...patch.addNodes);
    }

    // Remove links
    if (patch.removeLinks && patch.removeLinks.length > 0) {
        const removeKeys = new Set(
            patch.removeLinks.map(l => `${l.from}:${l.to}`)
        );
        currentTopology.links = currentTopology.links.filter(
            l => !removeKeys.has(`${l.from}:${l.to}`)
        );
    }

    // Set links (replace all)
    if (patch.setLinks) {
        currentTopology.links = [...patch.setLinks];
    }

    // Add links
    if (patch.addLinks && patch.addLinks.length > 0) {
        currentTopology.links.push(...patch.addLinks);
    }

    topologyVersion++;

    const after = {
        nodes: currentTopology.nodes.length,
        links: currentTopology.links.length
    };

    // RUN 7: Diff summary
    const diff = {
        nodesAdded: (patch.addNodes?.length || 0),
        nodesRemoved: (patch.removeNodes?.length || 0),
        linksAdded: (patch.addLinks?.length || 0),
        linksRemoved: (patch.removeLinks?.length || 0),
        linksReplaced: patch.setLinks ? true : false
    };

    console.log(
        `[TopologyControl] patchTopology: nodes ${before.nodes}→${after.nodes}, links ${before.links}→${after.links} (v${topologyVersion})`,
        diff
    );
}
