/**
 * Spring Edge Derivation
 * 
 * Converts directed knowledge links to undirected physics spring edges.
 */

import type { Topology, DirectedLink, SpringEdge, NodeId } from './topologyTypes';
import { computeRestLengths } from './restLengthPolicy';
import type { ForceConfig } from '../physics/types';

/**
 * Derive undirected spring edges from directed links.
 * 
 * Rules:
 * - Every directed link produces one undirected spring edge
 * - De-duplicate: A→B and B→A become one spring (min,max canonical key)
 * - Spring edge stores reference to source DirectedLink IDs for traceability
 * 
 * RUN 9: Now applies rest length policy to each spring edge.
 * 
 * @param topology The knowledge graph
 * @param config Physics configuration (for rest length policy)
 * @returns Array of undirected spring edges for physics
 */
export function deriveSpringEdges(topology: Topology, config?: ForceConfig): SpringEdge[] {
    const edgeMap = new Map<string, SpringEdge>();

    // Build nodeId set for validation (STEP3-RUN5-FIX6)
    const nodeIdSet = new Set(topology.nodes.map(n => n.id));

    for (const link of topology.links) {
        // STEP3-RUN5-FIX6: Skip self-loops
        if (link.from === link.to) {
            if (import.meta.env.DEV) {
                console.warn(`[SpringDerivation] Skipped self-loop: ${link.from} → ${link.to}`);
            }
            continue;
        }

        // STEP3-RUN5-FIX6: Skip links with missing endpoints
        if (!nodeIdSet.has(link.from) || !nodeIdSet.has(link.to)) {
            if (import.meta.env.DEV) {
                console.warn(`[SpringDerivation] Skipped link with missing endpoint: ${link.from} → ${link.to}`);
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
            // Merge: add this link's ID to sourceLinks
            if (!existing.meta) existing.meta = {};
            if (!existing.meta.sourceLinks) existing.meta.sourceLinks = [];
            existing.meta.sourceLinks.push(`${link.from}→${link.to}`);
        } else {
            // Create new spring edge
            edgeMap.set(key, {
                a,
                b,
                // Optional: use link metadata to override spring params
                // For now, leave undefined to use engine defaults
                meta: {
                    sourceLinks: [`${link.from}→${link.to}`]
                }
            });
        }
    }

    const edges = Array.from(edgeMap.values());

    // RUN 9: Apply rest length policy
    if (config) {
        const restLengths = computeRestLengths(edges, topology, null, config);
        for (const edge of edges) {
            const key = `${edge.a}:${edge.b}`;
            edge.restLen = restLengths.get(key);
        }
    }

    // Console proof
    const totalDirectedLinks = topology.links.length;
    const dedupeRate = totalDirectedLinks > 0
        ? ((1 - edges.length / totalDirectedLinks) * 100).toFixed(1)
        : '0.0';

    console.log(`[Run9] deriveSpringEdges: ${totalDirectedLinks} directed links → ${edges.length} spring edges (dedupe: ${dedupeRate}%)`);

    return edges;
}
