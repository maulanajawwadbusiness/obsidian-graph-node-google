/**
 * Directed Link ID Generation
 * 
 * STEP4-RUN3: Generate stable IDs for directed links that NEVER sort endpoints.
 * This preserves semantic direction and allows parallel edges.
 */

import type { DirectedLink, NodeId } from './topologyTypes';

/**
 * Generate a unique ID for a directed link.
 * 
 * Format: `${from}→${to}::${rel}::${index}`
 * 
 * CRITICAL: Never sorts endpoints - A→B and B→A get different IDs.
 * 
 * @param link The directed link
 * @param index Optional index for parallel edges (default: 0)
 * @returns Unique link ID
 */
export function generateDirectedLinkId(link: DirectedLink, index: number = 0): string {
    const rel = link.kind || 'relates';
    return `${link.from}→${link.to}::${rel}::${index}`;
}

/**
 * Ensure all links in an array have IDs.
 * Generates IDs for links missing them.
 * 
 * STEP4-RUN3: Called at KGSpec load time.
 * 
 * @param links Array of directed links
 * @returns Links with IDs assigned
 */
export function ensureDirectedLinkIds(links: DirectedLink[]): DirectedLink[] {
    // Track how many times we've seen each (from, to, kind) combination
    const seenCombos = new Map<string, number>();

    return links.map(link => {
        if (link.id) {
            return link; // Already has ID
        }

        // Generate combo key for indexing (NOT for identity!)
        const comboKey = `${link.from}→${link.to}::${link.kind || 'relates'}`;
        const index = seenCombos.get(comboKey) || 0;
        seenCombos.set(comboKey, index + 1);

        // Generate ID
        const id = generateDirectedLinkId(link, index);

        return { ...link, id };
    });
}

/**
 * Parse a directed link ID to extract components.
 * 
 * @param id Link ID (format: `from→to::rel::index`)
 * @returns Parsed components or null if invalid
 */
export function parseDirectedLinkId(id: string): { from: NodeId; to: NodeId; rel: string; index: number } | null {
    const match = id.match(/^(.+)→(.+)::(.+)::(\d+)$/);
    if (!match) return null;

    return {
        from: match[1],
        to: match[2],
        rel: match[3],
        index: parseInt(match[4], 10)
    };
}
