/**
 * Spring Edge Derivation
 *
 * Converts directed knowledge links to undirected physics spring edges.
 */

import type { Topology, SpringEdge } from './topologyTypes';
import { computeRestLengths } from './restLengthPolicy';
import type { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';

/**
 * Derive undirected spring edges from directed links.
 *
 * Rules:
 * - Every directed link produces one undirected spring edge
 * - De-duplicate: A->B and B->A become one spring (min,max canonical key)
 * - Spring edge stores reference to source DirectedLink IDs for traceability
 *
 * RUN 9: Now applies rest length policy to each spring edge.
 *
 * @param topology The knowledge graph
 * @param config Physics configuration (for rest length policy)
 * @returns Array of undirected spring edges for physics
 */
export function deriveSpringEdges(
    topology: Topology,
    config?: ForceConfig,
    opts?: { silent?: boolean }
): SpringEdge[] {
    const edgeMap = new Map<string, SpringEdge>();
    const nodeIdSet = new Set(topology.nodes.map(n => n.id));
    const totalDirectedLinks = topology.links.length;
    const appliedConfig = config || DEFAULT_PHYSICS_CONFIG;

    for (const link of topology.links) {
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
                restLen: 0,
                stiffness: link.weight ?? 1.0,
                contributors: link.id ? [link.id] : []
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
    }

    return validEdges;
}
