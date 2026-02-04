/**
 * Topology Control API
 *
 * Single source of truth for graph topology (nodes + directed links).
 * Enforces immutability and provides centralized mutation.
 */

import type { Topology, NodeSpec, DirectedLink } from './topologyTypes';
import type { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { deriveSpringEdges } from './springDerivation';
import { ensureDirectedLinkIds } from './directedLinkId';
import { computeLinkDiff, computeSpringDiff } from './topologyControlHelpers';

// STEP6-RUN3: Import mutation observer (dev-only)
let emitMutationEvent: any = null;
const pendingMutationEvents: any[] = [];
if (import.meta.env.DEV) {
    import('./topologyMutationObserver').then(mod => {
        emitMutationEvent = mod.emitMutationEvent;
        while (pendingMutationEvents.length > 0) {
            emitMutationEvent(pendingMutationEvents.shift());
        }
    });
}

function emitMutationEventSafe(event: any): void {
    if (!import.meta.env.DEV) return;
    if (emitMutationEvent) {
        emitMutationEvent(event);
        return;
    }
    pendingMutationEvents.push(event);
}

/**
 * Internal state (private to this module)
 */
let currentTopology: Topology = {
    nodes: [],
    links: [],
    springs: []
};

let topologyVersion = 0;

type LinkValidation = {
    ok: boolean;
    errors: string[];
    counts: {
        selfLoops: number;
        missingEndpoints: number;
        duplicateIds: number;
    };
};

function validateLinks(
    links: DirectedLink[],
    nodeIdSet: Set<string>,
    context: string
): LinkValidation {
    const errors: string[] = [];
    const seenIds = new Set<string>();
    let selfLoops = 0;
    let missingEndpoints = 0;
    let duplicateIds = 0;

    for (const link of links) {
        if (link.from === link.to) {
            selfLoops++;
            if (errors.length < 5) {
                errors.push(`${context}: self-loop ${link.from}->${link.to}`);
            }
            continue;
        }

        if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
            missingEndpoints++;
            if (errors.length < 5) {
                errors.push(
                    `${context}: missing endpoint ${link.from}->${link.to} (from=${nodeIdSet.has(link.from)}, to=${nodeIdSet.has(link.to)})`
                );
            }
            continue;
        }

        if (link.id) {
            if (seenIds.has(link.id)) {
                duplicateIds++;
                if (errors.length < 5) {
                    errors.push(`${context}: duplicate link id ${link.id}`);
                }
                continue;
            }
            seenIds.add(link.id);
        }
    }

    return {
        ok: selfLoops === 0 && missingEndpoints === 0 && duplicateIds === 0,
        errors,
        counts: { selfLoops, missingEndpoints, duplicateIds }
    };
}

function logValidationFailure(result: LinkValidation, context: string): void {
    console.error(`[TopologyControl] ${context} rejected: invalid links`);
    for (const err of result.errors) {
        console.error(`  - ${err}`);
    }
    const { selfLoops, missingEndpoints, duplicateIds } = result.counts;
    console.error(
        `[TopologyControl] ${context} summary: selfLoops=${selfLoops}, missingEndpoints=${missingEndpoints}, duplicateIds=${duplicateIds}`
    );
}

function devAssertTopologyInvariants(
    topology: Topology,
    config: ForceConfig | undefined,
    context: string
): string[] {
    if (!import.meta.env.DEV) return [];

    const warnings: string[] = [];
    let hasIssue = false;
    const missingIds = topology.links.filter(l => !l.id).length;
    if (missingIds > 0) {
        hasIssue = true;
        const msg = `[TopologyControl] ${context}: ${missingIds} link(s) missing id`;
        warnings.push(msg);
        console.warn(msg);
    }

    const linkIdSet = new Set(topology.links.map(l => l.id).filter(Boolean));
    let missingContributorCount = 0;
    for (const spring of topology.springs || []) {
        for (const contributor of spring.contributors || []) {
            if (!linkIdSet.has(contributor)) {
                missingContributorCount++;
                if (missingContributorCount <= 3) {
                    const msg = `[TopologyControl] ${context}: spring contributor missing link id ${contributor}`;
                    warnings.push(msg);
                    console.warn(msg);
                }
            }
        }
    }

    if (missingContributorCount > 0) {
        hasIssue = true;
        const msg = `[TopologyControl] ${context}: ${missingContributorCount} missing spring contributor link id(s)`;
        warnings.push(msg);
        console.warn(msg);
    }

    const freshSprings = deriveSpringEdges(
        { nodes: topology.nodes, links: topology.links },
        config || DEFAULT_PHYSICS_CONFIG,
        { silent: true }
    );
    const currentCount = topology.springs?.length || 0;
    if (currentCount !== freshSprings.length) {
        hasIssue = true;
        const msg = `[TopologyControl] ${context}: spring count mismatch (current=${currentCount}, fresh=${freshSprings.length})`;
        warnings.push(msg);
        console.warn(msg);
    }

    if (hasIssue) {
        console.warn(`[TopologyControl] ${context}: dev-only invariant check failed`);
    }
    return warnings;
}

function ensureSprings(reason: string, config?: ForceConfig): void {
    if (currentTopology.links.length === 0) return;
    if (currentTopology.springs && currentTopology.springs.length > 0) return;

    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);

    if (import.meta.env.DEV) {
        console.warn(
            `[TopologyControl] Springs were missing (${reason}); derived ${currentTopology.springs.length} from ${currentTopology.links.length} links`
        );
    }
}

/**
 * Set the entire topology (replaces current state).
 * Creates a defensive copy to prevent external mutation.
 *
 * STEP3-RUN5-V3-FIX1: Recompute springs internally within setTopology.
 * STEP3-RUN5-V4-FIX2: Accept optional config for rest-length policy.
 * STEP5-RUN4: Reject mutation if link invariants fail.
 */
export function setTopology(topology: Topology, config?: ForceConfig): void {
    const linksWithIds = ensureDirectedLinkIds(topology.links);
    const nodeIdSet = new Set(topology.nodes.map(n => n.id));
    const validation = validateLinks(linksWithIds, nodeIdSet, 'setTopology');

    // STEP6-RUN3: Capture before state
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    if (!validation.ok) {
        logValidationFailure(validation, 'setTopology');

        // STEP6-RUN3: Emit rejected event
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'setTopology' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: validation.errors,
            mutationId: 0,
            timestamp: 0
        });
        return;
    }

    currentTopology = {
        nodes: [...topology.nodes],
        links: [...linksWithIds],
        springs: []
    };

    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
    topologyVersion++;

    // STEP6-RUN3: Capture after state
    const countsAfter = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };

    if (import.meta.env.DEV) {
        console.log(
            `[TopologyControl] setTopology: ${currentTopology.nodes.length} nodes, ${currentTopology.links.length} links (v${topologyVersion})`
        );
    }

    const invariantWarnings = devAssertTopologyInvariants(currentTopology, config, 'setTopology');

    // STEP6-RUN3: Emit applied event
    const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
    const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
    emitMutationEventSafe({
        status: 'applied' as const,
        source: 'setTopology' as const,
        versionBefore,
        versionAfter: topologyVersion,
        countsBefore,
        countsAfter,
        linkDiff,
        springDiff,
        invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
        mutationId: 0,
        timestamp: 0
    });
}

/**
 * Get a defensive copy of the current topology.
 */
export function getTopology(): Topology {
    ensureSprings('getTopology');
    return {
        nodes: [...currentTopology.nodes],
        links: [...currentTopology.links],
        springs: currentTopology.springs ? [...currentTopology.springs] : []
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
 * Add a knowledge link and return its ID.
 * If link doesn't have an ID, one is generated.
 */
export function addKnowledgeLink(link: DirectedLink, config?: ForceConfig): string {
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    const nodeIdSet = new Set(currentTopology.nodes.map(n => n.id));
    const candidate = ensureDirectedLinkIds([link], currentTopology.links)[0];
    const validation = validateLinks([candidate], nodeIdSet, 'addKnowledgeLink');

    if (!validation.ok) {
        logValidationFailure(validation, 'addKnowledgeLink');
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'addKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: validation.errors,
            mutationId: 0,
            timestamp: 0
        });
        return '';
    }

    if (candidate.id && currentTopology.links.some(l => l.id === candidate.id)) {
        if (import.meta.env.DEV) {
            console.warn(
                `[TopologyControl] addKnowledgeLink: duplicate link id ${candidate.id}, rejected`
            );
        }
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'addKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: [`addKnowledgeLink: duplicate link id ${candidate.id}`],
            mutationId: 0,
            timestamp: 0
        });
        return '';
    }

    currentTopology.links.push(candidate);
    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
    topologyVersion++;

    if (import.meta.env.DEV) {
        console.log(
            `[TopologyControl] addKnowledgeLink: ${candidate.from} -> ${candidate.to} (id: ${candidate.id})`
        );
    }

    const invariantWarnings = devAssertTopologyInvariants(currentTopology, config, 'addKnowledgeLink');

    const countsAfter = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
    const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
    emitMutationEventSafe({
        status: 'applied' as const,
        source: 'addKnowledgeLink' as const,
        versionBefore,
        versionAfter: topologyVersion,
        countsBefore,
        countsAfter,
        linkDiff,
        springDiff,
        invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
        mutationId: 0,
        timestamp: 0
    });

    return candidate.id || '';
}

/**
 * Remove a knowledge link by ID.
 * NEVER affects other links (even with same endpoints).
 */
export function removeKnowledgeLink(linkId: string, config?: ForceConfig): boolean {
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    const beforeCount = currentTopology.links.length;
    currentTopology.links = currentTopology.links.filter(l => l.id !== linkId);
    const removed = currentTopology.links.length < beforeCount;

    if (removed) {
        currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
        topologyVersion++;

        if (import.meta.env.DEV) {
            console.log(`[TopologyControl] removeKnowledgeLink: removed link ${linkId}`);
        }

        const invariantWarnings = devAssertTopologyInvariants(currentTopology, config, 'removeKnowledgeLink');

        const countsAfter = {
            nodes: currentTopology.nodes.length,
            directedLinks: currentTopology.links.length,
            springs: currentTopology.springs?.length || 0
        };
        const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
        const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
        emitMutationEventSafe({
            status: 'applied' as const,
            source: 'removeKnowledgeLink' as const,
            versionBefore,
            versionAfter: topologyVersion,
            countsBefore,
            countsAfter,
            linkDiff,
            springDiff,
            invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
            mutationId: 0,
            timestamp: 0
        });
    } else if (import.meta.env.DEV) {
        console.warn(`[TopologyControl] removeKnowledgeLink: link ${linkId} not found`);
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'removeKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: [`removeKnowledgeLink: link ${linkId} not found`],
            mutationId: 0,
            timestamp: 0
        });
    }

    return removed;
}

/**
 * Update a knowledge link by ID.
 */
export function updateKnowledgeLink(
    linkId: string,
    patch: Partial<DirectedLink>,
    config?: ForceConfig
): boolean {
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    const link = currentTopology.links.find(l => l.id === linkId);

    if (!link) {
        if (import.meta.env.DEV) {
            console.warn(`[TopologyControl] updateKnowledgeLink: link ${linkId} not found`);
        }
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'updateKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: [`updateKnowledgeLink: link ${linkId} not found`],
            mutationId: 0,
            timestamp: 0
        });
        return false;
    }

    if (patch.id && patch.id !== linkId) {
        console.warn(
            `[TopologyControl] updateKnowledgeLink: id is stable; attempted ${linkId} -> ${patch.id}`
        );
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'updateKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: [`updateKnowledgeLink: id is stable; attempted ${linkId} -> ${patch.id}`],
            mutationId: 0,
            timestamp: 0
        });
        return false;
    }

    const nextLink: DirectedLink = { ...link, ...patch, id: linkId };
    const nodeIdSet = new Set(currentTopology.nodes.map(n => n.id));
    const validation = validateLinks([nextLink], nodeIdSet, 'updateKnowledgeLink');
    if (!validation.ok) {
        logValidationFailure(validation, 'updateKnowledgeLink');
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'updateKnowledgeLink' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: validation.errors,
            mutationId: 0,
            timestamp: 0
        });
        return false;
    }

    Object.assign(link, nextLink);

    if (patch.from !== undefined || patch.to !== undefined || patch.weight !== undefined) {
        currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
    }

    topologyVersion++;

    if (import.meta.env.DEV) {
        console.log(`[TopologyControl] updateKnowledgeLink: updated link ${linkId}`);
    }

    const invariantWarnings = devAssertTopologyInvariants(currentTopology, config, 'updateKnowledgeLink');

    const countsAfter = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
    const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
    emitMutationEventSafe({
        status: 'applied' as const,
        source: 'updateKnowledgeLink' as const,
        versionBefore,
        versionAfter: topologyVersion,
        countsBefore,
        countsAfter,
        linkDiff,
        springDiff,
        invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
        mutationId: 0,
        timestamp: 0
    });

    return true;
}

/**
 * Get a knowledge link by ID.
 */
export function getKnowledgeLink(linkId: string): DirectedLink | undefined {
    return currentTopology.links.find(l => l.id === linkId);
}

/**
 * Clear the topology (remove all nodes and links).
 */
export function clearTopology(): void {
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    currentTopology = {
        nodes: [],
        links: [],
        springs: []
    };
    topologyVersion++;

    if (import.meta.env.DEV) {
        console.log(`[TopologyControl] clearTopology (v${topologyVersion})`);
    }

    const invariantWarnings = devAssertTopologyInvariants(currentTopology, undefined, 'clearTopology');

    const countsAfter = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
    const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
    emitMutationEventSafe({
        status: 'applied' as const,
        source: 'clearTopology' as const,
        versionBefore,
        versionAfter: topologyVersion,
        countsBefore,
        countsAfter,
        linkDiff,
        springDiff,
        invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
        mutationId: 0,
        timestamp: 0
    });
}

/**
 * Patch options for incremental topology updates.
 */
export interface TopologyPatch {
    addNodes?: NodeSpec[];
    removeNodes?: string[];
    addLinks?: DirectedLink[];
    removeLinkIds?: string[];
    removeLinks?: Array<{ id?: string; from?: string; to?: string }>;
    setLinks?: DirectedLink[];
}

/**
 * Apply a patch to the current topology.
 * More efficient than setTopology for small changes.
 *
 * STEP3-RUN5-V4-FIX2: Accept optional config for rest-length policy.
 * STEP5-RUN4: Reject entire patch if any invariants fail.
 */
export function patchTopology(patch: TopologyPatch, config?: ForceConfig): void {
    const before = {
        nodes: currentTopology.nodes.length,
        links: currentTopology.links.length
    };

    // STEP6-RUN4: Capture before state
    const versionBefore = topologyVersion;
    const countsBefore = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };
    const linksBefore = [...currentTopology.links];
    const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];

    let nextNodes = [...currentTopology.nodes];
    let nextLinks = ensureDirectedLinkIds([...currentTopology.links]);
    let removedLinkCount = 0;
    let acceptedLinks = 0;
    let changed = false;

    // Remove nodes
    if (patch.removeNodes && patch.removeNodes.length > 0) {
        const removeSet = new Set(patch.removeNodes);
        nextNodes = nextNodes.filter(n => !removeSet.has(n.id));
        nextLinks = nextLinks.filter(l => !removeSet.has(l.from) && !removeSet.has(l.to));
        changed = true;
    }

    // Add nodes
    if (patch.addNodes && patch.addNodes.length > 0) {
        nextNodes.push(...patch.addNodes);
        changed = true;
    }

    // Remove links by ID
    if (patch.removeLinkIds && patch.removeLinkIds.length > 0) {
        const removeIdSet = new Set(patch.removeLinkIds);
        const beforeLinks = nextLinks.length;
        nextLinks = nextLinks.filter(l => !l.id || !removeIdSet.has(l.id));
        removedLinkCount += beforeLinks - nextLinks.length;
        changed = true;
    }

    // Remove links by id or endpoints (legacy)
    if (patch.removeLinks && patch.removeLinks.length > 0) {
        for (const remove of patch.removeLinks) {
            let removeId = remove.id;

            if (!removeId && remove.from && remove.to) {
                const matches = nextLinks.filter(l => l.from === remove.from && l.to === remove.to);

                if (matches.length === 0) {
                    if (import.meta.env.DEV) {
                        console.warn(
                            `[TopologyControl] removeLinks: no match for ${remove.from} -> ${remove.to}`
                        );
                    }
                    continue;
                }

                if (matches.length > 1 && import.meta.env.DEV) {
                    console.warn(
                        `[TopologyControl] removeLinks: multiple matches for ${remove.from} -> ${remove.to}; removing first only`
                    );
                }

                removeId = matches[0].id;
            }

            if (!removeId) {
                if (import.meta.env.DEV) {
                    console.warn('[TopologyControl] removeLinks: missing id or endpoints');
                }
                continue;
            }

            const beforeLinks = nextLinks.length;
            nextLinks = nextLinks.filter(l => l.id !== removeId);
            removedLinkCount += beforeLinks - nextLinks.length;
            changed = true;
        }
    }

    // Set links (replace all)
    if (patch.setLinks) {
        nextLinks = [...patch.setLinks];
        changed = true;
    }

    // Add links
    if (patch.addLinks && patch.addLinks.length > 0) {
        nextLinks.push(...patch.addLinks);
        acceptedLinks += patch.addLinks.length;
        changed = true;
    }

    if (!changed) {
        return;
    }

    nextLinks = ensureDirectedLinkIds(nextLinks);
    const nodeIdSet = new Set(nextNodes.map(n => n.id));
    const validation = validateLinks(nextLinks, nodeIdSet, 'patchTopology');

    if (!validation.ok) {
        logValidationFailure(validation, 'patchTopology');

        // STEP6-RUN4: Emit rejected event
        emitMutationEventSafe({
            status: 'rejected' as const,
            source: 'patchTopology' as const,
            versionBefore,
            versionAfter: versionBefore,
            countsBefore,
            countsAfter: countsBefore,
            validationErrors: validation.errors,
            mutationId: 0,
            timestamp: 0
        });
        return;
    }

    currentTopology = {
        nodes: nextNodes,
        links: nextLinks,
        springs: []
    };
    currentTopology.springs = deriveSpringEdges(currentTopology, config || DEFAULT_PHYSICS_CONFIG);
    topologyVersion++;

    const after = {
        nodes: currentTopology.nodes.length,
        links: currentTopology.links.length
    };

    // STEP6-RUN4: Capture after state
    const countsAfter = {
        nodes: currentTopology.nodes.length,
        directedLinks: currentTopology.links.length,
        springs: currentTopology.springs?.length || 0
    };

    const diff = {
        nodesAdded: patch.addNodes?.length || 0,
        nodesRemoved: patch.removeNodes?.length || 0,
        linksAdded: acceptedLinks,
        linksRemoved: removedLinkCount,
        linksReplaced: !!patch.setLinks
    };

    console.log(
        `[TopologyControl] patchTopology: nodes ${before.nodes}->${after.nodes}, links ${before.links}->${after.links} (v${topologyVersion})`,
        diff
    );

    const invariantWarnings = devAssertTopologyInvariants(currentTopology, config, 'patchTopology');

    // STEP6-RUN4: Emit applied event with link diff
    const linkDiff = computeLinkDiff(linksBefore, currentTopology.links);
    const springDiff = computeSpringDiff(springsBefore, currentTopology.springs);
    emitMutationEventSafe({
        status: 'applied' as const,
        source: 'patchTopology' as const,
        versionBefore,
        versionAfter: topologyVersion,
        countsBefore,
        countsAfter,
        linkDiff,
        springDiff,
        invariantWarnings: invariantWarnings.length > 0 ? invariantWarnings : undefined,
        mutationId: 0,
        timestamp: 0
    });
}
