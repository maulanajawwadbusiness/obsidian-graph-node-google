/**
 * Topology Control API
 * 
 * Single source of truth for graph topology (nodes + directed links).
 * Enforces immutability and provides centralized mutation.
 */

import type { Topology, NodeSpec, DirectedLink } from './topologyTypes';
import type { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { deriveSpringEdges } from './springDerivation'; // STEP3-RUN5-V3-FIX1

/**
 * Internal state (private to this module)
 */
let currentTopology: Topology = {
    nodes: [],
    links: [],
    springs: [] // STEP3-RUN2: Explicit storage for undirected physics springs
};

let topologyVersion = 0;

/**
 * Set the entire topology (replaces current state).
 * Creates a defensive copy to prevent external mutation.
 * 
 * STEP3-RUN5-V3-FIX1: Recompute springs internally within setTopology.
 * STEP3-RUN5-V4-FIX2: Accept optional config for rest-length policy.
 * This is the single authoritative seam for topology changes.
 */
export function setTopology(topology: Topology, config?: ForceConfig): void {
    currentTopology = {
        nodes: [...topology.nodes],
        links: [...topology.links],
        springs: [] // Will be computed immediately below
    };

    // STEP3-RUN5-V3-FIX1: Always recompute springs from links
    // STEP3-RUN5-V4-FIX2: Pass config for rest-length policy
    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);

    // STEP3-RUN5-V4-FIX3: Dev-only invariant check (moved from recomputeSprings)
    // STEP3-RUN5-V5-FIX3: Expanded to catch missing springs even when none provided
    if (import.meta.env.DEV) {
        const freshCount = currentTopology.springs.length;
        const linksCount = currentTopology.links.length;

        // Check if springs were provided and differ from fresh derivation
        if (topology.springs && topology.springs.length > 0) {
            const providedCount = topology.springs.length;
            if (freshCount !== providedCount) {
                console.warn(`[TopologyControl] ⚠ Spring count mismatch! Fresh=${freshCount}, Provided=${providedCount}`);
                console.warn(`[TopologyControl] Provided springs were stale - replaced with fresh derivation`);
            }
        }

        // Check if springs are missing while links exist
        if (freshCount === 0 && linksCount > 0) {
            console.warn(`[TopologyControl] ⚠ Springs missing but ${linksCount} links exist! This should not happen.`);
        }

        // Log successful derivation
        if (freshCount > 0) {
            console.log(`[TopologyControl] ✓ Springs derived: ${freshCount} from ${linksCount} directed links`);
        }
    }

    topologyVersion++;
    console.log(`[TopologyControl] setTopology: ${currentTopology.nodes.length} nodes, ${currentTopology.links.length} links, ${currentTopology.springs?.length || 0} springs (v${topologyVersion})`);
}

/**
 * Get the current topology (returns a copy to prevent mutation).
 */
export function getTopology(): Topology {
    return {
        nodes: [...currentTopology.nodes],
        links: [...currentTopology.links],
        springs: currentTopology.springs ? [...currentTopology.springs] : [] // STEP3-RUN2: Return springs copy
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
        links: [],
        springs: [] // STEP3-RUN2: Clear springs too
    };
    topologyVersion++;
    console.log(`[TopologyControl] clearTopology (v${topologyVersion})`)
        ;
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
 * Apply a patch to the current topology.
 * More efficient than setTopology for small changes.
 * 
 * STEP3-RUN5-V4-FIX2: Accept optional config for rest-length policy.
 */
export function patchTopology(patch: TopologyPatch, config?: ForceConfig): void {
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

    // PRE-STEP2: Add links with validation
    if (patch.addLinks && patch.addLinks.length > 0) {
        // Build node ID set for validation
        const nodeIdSet = new Set(currentTopology.nodes.map(n => n.id));

        // Validation counters
        let accepted = 0;
        let rejectedSelfLoops = 0;
        let rejectedMissingEndpoint = 0;
        let deduped = 0;

        // Track existing links for deduplication
        const existingKeys = new Set(currentTopology.links.map(l => `${l.from}:${l.to}`));

        for (const link of patch.addLinks) {
            // Validation 1: Reject self-loops
            if (link.from === link.to) {
                console.warn(`[TopologyControl] Rejected self-loop: ${link.from} → ${link.to}`);
                rejectedSelfLoops++;
                continue;
            }

            // Validation 2: Reject links with missing endpoints
            if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
                console.warn(`[TopologyControl] Rejected link with missing endpoint: ${link.from} → ${link.to} (nodes exist: from=${nodeIdSet.has(link.from)}, to=${nodeIdSet.has(link.to)})`);
                rejectedMissingEndpoint++;
                continue;
            }

            // Validation 3: Check for duplicates
            const key = `${link.from}:${link.to}`;
            if (existingKeys.has(key)) {
                deduped++;
                continue;
            }

            // Accept link
            currentTopology.links.push(link);
            existingKeys.add(key);
            accepted++;
        }

        // Log validation summary if any rejections occurred
        if (rejectedSelfLoops > 0 || rejectedMissingEndpoint > 0 || deduped > 0) {
            console.log(`[TopologyControl] Validation: accepted=${accepted}, rejectedSelfLoops=${rejectedSelfLoops}, rejectedMissing=${rejectedMissingEndpoint}, deduped=${deduped}`);
        }
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

    // STEP3-RUN5-V3-FIX4: Recompute springs after node/link mutations
    // STEP3-RUN5-V4-FIX2: Pass config for rest-length policy
    if (diff.nodesRemoved > 0 || diff.linksAdded > 0 || diff.linksRemoved > 0 || diff.linksReplaced) {
        currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
        if (import.meta.env.DEV) {
            console.log(`[TopologyControl] Springs recomputed after patch: ${currentTopology.springs.length} springs`);
        }
    }

    console.log(
        `[TopologyControl] patchTopology: nodes ${before.nodes}→${after.nodes}, links ${before.links}→${after.links} (v${topologyVersion})`,
        diff
    );
}
