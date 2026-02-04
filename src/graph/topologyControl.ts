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
import { ensureDirectedLinkIds } from './directedLinkId'; // STEP4-RUN5

/**
 * Internal state (private to this module)
 */
let currentTopology: Topology = {
    nodes: [],
    links: [],
    springs: [] // STEP3-RUN2: Explicit storage for undirected physics springs
};

let topologyVersion = 0;

function ensureSprings(reason: string, config?: ForceConfig): void {
    if (currentTopology.links.length === 0) return;
    if (currentTopology.springs && currentTopology.springs.length > 0) return;

    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);

    if (import.meta.env.DEV) {
        console.warn(`[TopologyControl] Springs were missing (${reason}); derived ${currentTopology.springs.length} from ${currentTopology.links.length} links`);
    }
}

/**
 * Set the entire topology (replaces current state).
 * Creates a defensive copy to prevent external mutation.
 * 
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
import { ensureDirectedLinkIds } from './directedLinkId'; // STEP4-RUN5

/**
 * Internal state (private to this module)
 */
let currentTopology: Topology = {
    nodes: [],
    links: [],
    springs: [] // STEP3-RUN2: Explicit storage for undirected physics springs
};

let topologyVersion = 0;

function ensureSprings(reason: string, config?: ForceConfig): void {
    if (currentTopology.links.length === 0) return;
    if (currentTopology.springs && currentTopology.springs.length > 0) return;

    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);

    if (import.meta.env.DEV) {
        console.warn(`[TopologyControl] Springs were missing (${reason}); derived ${currentTopology.springs.length} from ${currentTopology.links.length} links`);
    }
}

/**
 * Set the entire topology (replaces current state).
 * Creates a defensive copy to prevent external mutation.
 * 
 * STEP3-RUN5-V3-FIX1: Recompute springs internally within setTopology.
 * STEP3-RUN5-V4-FIX2: Accept optional config for rest-length policy.
 * This is the single authoritative seam for topology changes.
 */
export function setTopology(topology: Topology, config?: ForceConfig): void {
    const linksWithIds = ensureDirectedLinkIds(topology.links);

    // STEP5-RUN4: Validate before mutation
    if (import.meta.env.DEV) {
        const nodeIdSet = new Set(topology.nodes.map(n => n.id));
        let rejectedSelfLoops = 0;
        let rejectedMissingEndpoints = 0;
        let rejectedDuplicateIds = 0;

        const seenIds = new Set<string>();
        const validLinks: DirectedLink[] = [];

        for (const link of linksWithIds) {
            // Check self-loops
            if (link.from === link.to) {
                console.warn(`[TopologyControl] setTopology: rejected self-loop ${link.from} -> ${link.to}`);
                rejectedSelfLoops++;
                continue;
            }

            // Check missing endpoints
            if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
                console.warn(`[TopologyControl] setTopology: rejected link with missing endpoint ${link.from} -> ${link.to}`);
                rejectedMissingEndpoints++;
                continue;
            }

            // Check duplicate IDs
            if (link.id && seenIds.has(link.id)) {
                console.warn(`[TopologyControl] setTopology: rejected duplicate link ID ${link.id}`);
                rejectedDuplicateIds++;
                continue;
            }

            if (link.id) seenIds.add(link.id);
            validLinks.push(link);
        }

        if (rejectedSelfLoops > 0 || rejectedMissingEndpoints > 0 || rejectedDuplicateIds > 0) {
            console.warn(`[TopologyControl] setTopology validation: rejected ${rejectedSelfLoops} self-loops, ${rejectedMissingEndpoints} missing endpoints, ${rejectedDuplicateIds} duplicate IDs`);
        }

        linksWithIds.length = 0;
        linksWithIds.push(...validLinks);
    }

    currentTopology = {
        nodes: [...topology.nodes],
        links: [...linksWithIds],
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
        const seenIds = new Set<string>();
        const dupes: string[] = [];

        for (const link of currentTopology.links) {
            if (!link.id) continue;
            if (seenIds.has(link.id)) {
                dupes.push(link.id);
            } else {
                seenIds.add(link.id);
            }
        }

        if (dupes.length > 0) {
            console.warn(`[TopologyControl] Duplicate directed link IDs detected:`, dupes);
        }
        export function getTopology(): Topology {
            ensureSprings('getTopology');
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
         * STEP4-RUN5: Add a knowledge link and return its ID.
         * If link doesn't have an ID, one is generated.
         * 
         * @param link The directed link to add
         * @param config Optional physics config for spring recomputation
         * @returns The link ID
         */
        export function addKnowledgeLink(link: DirectedLink, config?: ForceConfig): string {
            // Ensure link has an ID
            const linksWithIds = ensureDirectedLinkIds([link], currentTopology.links);
            const linkWithId = linksWithIds[0];

            if (linkWithId.id && currentTopology.links.some(l => l.id === linkWithId.id)) {
                if (import.meta.env.DEV) {
                    console.warn(`[TopologyControl] addKnowledgeLink: link ID already exists, skipping add (${linkWithId.id})`);
                }
                return linkWithId.id;
            }

            // Add to topology
            currentTopology.links.push(linkWithId);

            // Recompute springs
            currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);

            topologyVersion++;

            if (import.meta.env.DEV) {
                console.log(`[TopologyControl] addKnowledgeLink: ${linkWithId.from} -> ${linkWithId.to} (id: ${linkWithId.id})`);
            }

            return linkWithId.id!;
        }

        /**
         * STEP4-RUN5: Remove a knowledge link by ID.
         * NEVER affects other links (even with same endpoints).
         * 
         * @param linkId The link ID to remove
         * @param config Optional physics config for spring recomputation
         * @returns Whether the link was found and removed
         */
        export function removeKnowledgeLink(linkId: string, config?: ForceConfig): boolean {
            const beforeCount = currentTopology.links.length;

            // Remove by ID (NOT by endpoints)
            currentTopology.links = currentTopology.links.filter(l => l.id !== linkId);

            const removed = currentTopology.links.length < beforeCount;

            if (removed) {
                // Recompute springs
                currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
                topologyVersion++;

                if (import.meta.env.DEV) {
                    console.log(`[TopologyControl] removeKnowledgeLink: removed link ${linkId}`);
                }
            } else if (import.meta.env.DEV) {
                console.warn(`[TopologyControl] removeKnowledgeLink: link ${linkId} not found`);
            }

            return removed;
        }

        /**
         * STEP4-RUN5: Update a knowledge link by ID.
         * 
         * @param linkId The link ID to update
         * @param patch Partial link data to merge
         * @param config Optional physics config for spring recomputation
         * @returns Whether the link was found and updated
         */
        export function updateKnowledgeLink(linkId: string, patch: Partial<DirectedLink>, config?: ForceConfig): boolean {
            const link = currentTopology.links.find(l => l.id === linkId);

            if (!link) {
                if (import.meta.env.DEV) {
                    console.warn(`[TopologyControl] updateKnowledgeLink: link ${linkId} not found`);
                }
                return false;
            }

            // Merge patch (preserve ID)
            Object.assign(link, patch);
            link.id = linkId; // Ensure ID never changes

            // Recompute springs if endpoints or weight changed
            if (patch.from !== undefined || patch.to !== undefined || patch.weight !== undefined) {
                currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
            }

            topologyVersion++;

            if (import.meta.env.DEV) {
                console.log(`[TopologyControl] updateKnowledgeLink: updated link ${linkId}`);
            }

            return true;
        }

        /**
         * STEP4-RUN5: Get a knowledge link by ID.
         * 
         * @param linkId The link ID
         * @returns The link or undefined if not found
         */
        export function getKnowledgeLink(linkId: string): DirectedLink | undefined {
            return currentTopology.links.find(l => l.id === linkId);
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
            removeLinkIds?: string[]; // Preferred: remove by directedLinkId
            removeLinks?: Array<{ id?: string; from?: string; to?: string }>; // Legacy: avoid endpoint removal when possible
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

            currentTopology.links = ensureDirectedLinkIds(currentTopology.links);
            let removedLinkCount = 0;
            let acceptedLinks = 0;

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
            if (patch.removeLinkIds && patch.removeLinkIds.length > 0) {
                const removeIdSet = new Set(patch.removeLinkIds);
                const beforeLinks = currentTopology.links.length;
                currentTopology.links = currentTopology.links.filter(
                    l => !l.id || !removeIdSet.has(l.id)
                );
                removedLinkCount += beforeLinks - currentTopology.links.length;
            }

            if (patch.removeLinks && patch.removeLinks.length > 0) {
                for (const remove of patch.removeLinks) {
                    let removeId = remove.id;

                    if (!removeId && remove.from && remove.to) {
                        const matches = currentTopology.links.filter(
                            l => l.from === remove.from && l.to === remove.to
                        );

                        if (matches.length === 0) {
                            if (import.meta.env.DEV) {
                                console.warn(`[TopologyControl] removeLinks: no match for ${remove.from} -> ${remove.to}`);
                            }
                            continue;
                        }

                        if (matches.length > 1 && import.meta.env.DEV) {
                            console.warn(`[TopologyControl] removeLinks: multiple matches for ${remove.from} -> ${remove.to}; removing first only`);
                        }

                        removeId = matches[0].id;
                    }

                    if (!removeId) {
                        if (import.meta.env.DEV) {
                            console.warn('[TopologyControl] removeLinks: missing id or endpoints');
                        }
                        continue;
                    }

                    const beforeLinks = currentTopology.links.length;
                    currentTopology.links = currentTopology.links.filter(l => l.id !== removeId);
                    removedLinkCount += beforeLinks - currentTopology.links.length;
                }
            }

            // Set links (replace all)
            if (patch.setLinks) {
                currentTopology.links = ensureDirectedLinkIds(patch.setLinks);
            }

            // PRE-STEP2: Add links with validation
            if (patch.addLinks && patch.addLinks.length > 0) {
                // Build node ID set for validation
                const nodeIdSet = new Set(currentTopology.nodes.map(n => n.id));

                // Validation counters
                let rejectedSelfLoops = 0;
                let rejectedMissingEndpoint = 0;
                let rejectedDuplicateId = 0;

                const incomingLinks = ensureDirectedLinkIds(patch.addLinks, currentTopology.links);
                const existingIds = new Set(currentTopology.links.map(l => l.id).filter(Boolean));

                for (const link of incomingLinks) {
                    // Validation 1: Reject self-loops
                    if (link.from === link.to) {
                        console.warn(`[TopologyControl] Rejected self-loop: ${link.from} -> ${link.to}`);
                        rejectedSelfLoops++;
                        continue;
                    }

                    // Validation 2: Reject links with missing endpoints
                    if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
                        console.warn(`[TopologyControl] Rejected link with missing endpoint: ${link.from} -> ${link.to} (nodes exist: from=${nodeIdSet.has(link.from)}, to=${nodeIdSet.has(link.to)})`);
                        rejectedMissingEndpoint++;
                        continue;
                    }

                    // Validation 3: Reject duplicate IDs
                    if (link.id && existingIds.has(link.id)) {
                        rejectedDuplicateId++;
                        continue;
                    }

                    // Accept link
                    currentTopology.links.push(link);
                    if (link.id) {
                        existingIds.add(link.id);
                    }
                    acceptedLinks++;
                }

                // Log validation summary if any rejections occurred
                if (rejectedSelfLoops > 0 || rejectedMissingEndpoint > 0 || rejectedDuplicateId > 0) {
                    console.log(`[TopologyControl] Validation: accepted=${acceptedLinks}, rejectedSelfLoops=${rejectedSelfLoops}, rejectedMissing=${rejectedMissingEndpoint}, duplicateIds=${rejectedDuplicateId}`);
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
                linksAdded: acceptedLinks,
                linksRemoved: removedLinkCount,
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
                `[TopologyControl] patchTopology: nodes ${before.nodes}->${after.nodes}, links ${before.links}->${after.links} (v${topologyVersion})`,
                diff
            );
        }
