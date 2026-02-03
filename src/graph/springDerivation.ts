/**
 * Spring Edge Derivation
 * 
 * Converts directed knowledge links to undirected physics spring edges.
 */

import type { Topology, DirectedLink, SpringEdge, NodeId } from './topologyTypes';

/**
 * Derive undirected spring edges from directed links.
 * 
 * Rules:
 * - Every directed link produces one undirected spring edge
 * - De-duplicate: A→B and B→A become one spring (min,max canonical key)
 * - Spring edge stores reference to source DirectedLink IDs for traceability
 * 
 * @param topology The knowledge graph
 * @returns Array of undirected spring edges for physics
 */
export function deriveSpringEdges(topology: Topology): SpringEdge[] {
    const edgeMap = new Map<string, SpringEdge>();

    for (const link of topology.links) {
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

    // Console proof
    const totalDirectedLinks = topology.links.length;
    const dedupeRate = totalDirectedLinks > 0
        ? ((1 - edges.length / totalDirectedLinks) * 100).toFixed(1)
        : '0.0';

    console.log(`[Run5] deriveSpringEdges: ${totalDirectedLinks} directed links → ${edges.length} spring edges (dedupe: ${dedupeRate}%)`);

    return edges;
}
