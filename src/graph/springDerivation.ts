/**
 * Spring Edge Derivation
 *
 * Converts directed knowledge links to undirected physics spring edges.
 * STEP 8 - RUN 3: Added physics mapping policy support.
 */

import type { Topology, SpringEdge } from './topologyTypes';
import { computeRestLengths } from './restLengthPolicy';
import type { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import type { PhysicsMappingPolicy } from './physicsMappingPolicy';
import { DefaultPhysicsMappingPolicy } from './physicsMappingPolicy';

/**
 * Derive undirected spring edges from directed links.
 *
 * Rules:
 * - Every directed link produces one undirected spring edge
 * - De-duplicate: A->B and B->A become one spring (min,max canonical key)
 * - Spring edge stores reference to source DirectedLink IDs for traceability
 *
 * RUN 9: Now applies rest length policy to each spring edge.
 * STEP 8 - RUN 3: Added physics mapping policy (optional, defaults to baseline behavior).
 *
 * @param topology The knowledge graph
 * @param config Physics configuration (for rest length policy)
 * @param policy Physics mapping policy (optional, defaults to DefaultPhysicsMappingPolicy)
 * @returns Array of undirected spring edges for physics
 */
export function deriveSpringEdges(
    topology: Topology,
    config?: ForceConfig,
    policy?: PhysicsMappingPolicy,
    opts?: { silent?: boolean }
): SpringEdge[] {
    const edgeMap = new Map<string, SpringEdge>();
    const nodeIdSet = new Set(topology.nodes.map(n => n.id));
    const totalDirectedLinks = topology.links.length;
    const appliedConfig = config || DEFAULT_PHYSICS_CONFIG;
    const appliedPolicy = policy || DefaultPhysicsMappingPolicy;

    // STEP 8 - RUN 3: Apply policy to collect metadata
    if (!opts?.silent && import.meta.env.DEV) {
        console.groupCollapsed(`[PhysicsMappingPolicy] Using policy: ${appliedPolicy.name} v${appliedPolicy.version}`);
    }

    for (const link of topology.links) {
        // STEP 8 - RUN 3: Get policy params for this link
        const policyParams = appliedPolicy.mapLinkParams(link, {
            targetSpacing: appliedConfig.targetSpacing,
            xpbdLinkCompliance: appliedConfig.xpbdLinkCompliance,
            damping: appliedConfig.damping
        });

        // Skip if policy says no spring
        if (policyParams === undefined) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.log(`[SpringDerivation] Skipped link (policy): ${link.from} -> ${link.to} [${link.kind || 'relates'}]`);
            }
            continue;
        }

        // Skip self-loops
        if (link.from === link.to) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Skipped self-loop: ${link.from} -> ${link.to}`);
            }
            continue;
        }

        // Skip links with missing endpoints
        if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Skipped link with missing endpoint: ${link.from} -> ${link.to}`);
            }
            continue;
        }

        // Canonical key: always min(from, to) : max(from, to)
        const a = link.from < link.to ? link.from : link.to;
        const b = link.from < link.to ? link.to : link.from;
        const key = `${a}:${b}`;

        // De-duplicate
        const existing = edgeMap.get(key);
        if (existing) {
            if (!existing.contributors) existing.contributors = [];
            if (link.id) {
                existing.contributors.push(link.id);
            }

            if (import.meta.env.DEV && !opts?.silent) {
                console.log(`[SpringDerivation] Merged spring {${a}, ${b}}: ${existing.contributors?.length || 0} contributors`);
            }
        } else {
            const spring: SpringEdge = {
                a,
                b,
                restLen: 0, // Will be set by rest length policy
                stiffness: link.weight ?? 1.0,
                contributors: link.id ? [link.id] : [],
                // STEP 8 - RUN 3: Store policy metadata (no behavior change yet)
                meta: {
                    policyParams,
                    edgeType: link.kind || 'relates'
                }
            };
            edgeMap.set(key, spring);
        }
    }

    const edges = Array.from(edgeMap.values());
    const restLengths = computeRestLengths(edges, topology, null, appliedConfig, opts);
    for (const edge of edges) {
        const key = `${edge.a}:${edge.b}`;
        const restLen = restLengths.get(key);
        if (restLen !== undefined) {
            edge.restLen = restLen;
        }
    }

    // STEP5-RUN5: Numeric safety - drop invalid springs
    const validEdges: SpringEdge[] = [];
    let droppedNaN = 0;
    let droppedInvalidRestLen = 0;
    let droppedInvalidStiffness = 0;

    for (const edge of edges) {
        // Check for NaN/Infinity
        if (!isFinite(edge.restLen) || !isFinite(edge.stiffness)) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: NaN/Infinity (restLen=${edge.restLen}, stiffness=${edge.stiffness}, contributors=${edge.contributors?.join(', ')})`);
            }
            droppedNaN++;
            continue;
        }

        // Check restLen bounds (must be positive)
        if (edge.restLen <= 0) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: invalid restLen=${edge.restLen} (contributors=${edge.contributors?.join(', ')})`);
            }
            droppedInvalidRestLen++;
            continue;
        }

        // Check stiffness bounds (must be positive)
        if (edge.stiffness <= 0) {
            if (import.meta.env.DEV && !opts?.silent) {
                console.warn(`[SpringDerivation] Dropped spring {${edge.a}, ${edge.b}}: invalid stiffness=${edge.stiffness} (contributors=${edge.contributors?.join(', ')})`);
            }
            droppedInvalidStiffness++;
            continue;
        }

        validEdges.push(edge);
    }

    if (!opts?.silent && (droppedNaN > 0 || droppedInvalidRestLen > 0 || droppedInvalidStiffness > 0) && import.meta.env.DEV) {
        console.warn(`[SpringDerivation] Safety: dropped ${droppedNaN} NaN/Infinity, ${droppedInvalidRestLen} invalid restLen, ${droppedInvalidStiffness} invalid stiffness`);
    }

    const dedupeRate = totalDirectedLinks > 0
        ? ((1 - validEdges.length / totalDirectedLinks) * 100).toFixed(1)
        : '0.0';

    if (!opts?.silent && import.meta.env.DEV) {
        console.log(`[Run9] deriveSpringEdges: ${totalDirectedLinks} directed links -> ${validEdges.length} spring edges (dedupe: ${dedupeRate}%)`);
        console.groupEnd();
    }

    return validEdges;
}
