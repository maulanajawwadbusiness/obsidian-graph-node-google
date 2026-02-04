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
 * Format: `${from}->${to}::${rel}::${index}`
 *
 * CRITICAL: Never sorts endpoints - A->B and B->A get different IDs.
 *
 * @param link The directed link
 * @param index Optional index for parallel edges (default: 0)
 * @returns Unique link ID
 */
function getRel(link: DirectedLink): string {
    return link.kind || 'related';
}

function getComboKey(link: DirectedLink): string {
    return `${link.from}->${link.to}::${getRel(link)}`;
}

export function generateDirectedLinkId(link: DirectedLink, index: number = 0): string {
    const rel = getRel(link);
    return `${link.from}->${link.to}::${rel}::${index}`;
}

/**
 * Ensure all links in an array have IDs.
 * Generates IDs for links missing them.
 *
 * STEP4-RUN3: Called at KGSpec load time.
 *
 * @param links Array of directed links
 * @param existingLinks Optional existing links (prevents ID collisions)
 * @returns Links with IDs assigned
 */
export function ensureDirectedLinkIds(
    links: DirectedLink[],
    existingLinks: DirectedLink[] = []
): DirectedLink[] {
    const existingIds = new Set<string>();
    const comboCounts = new Map<string, number>();

    for (const link of existingLinks) {
        if (link.id) {
            existingIds.add(link.id);
        }
        const comboKey = getComboKey(link);
        comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + 1);
    }

    return links.map(link => {
        if (link.id) {
            existingIds.add(link.id);
            const comboKey = getComboKey(link);
            comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + 1);
            return link;
        }

        const comboKey = getComboKey(link);
        let index = comboCounts.get(comboKey) || 0;
        let id = generateDirectedLinkId(link, index);
        while (existingIds.has(id)) {
            index++;
            id = generateDirectedLinkId(link, index);
        }

        comboCounts.set(comboKey, index + 1);
        existingIds.add(id);

        return { ...link, id };
    });
}

/**
 * Parse a directed link ID to extract components.
 *
 * @param id Link ID (format: `from->to::rel::index`)
 * @returns Parsed components or null if invalid
 */
export function parseDirectedLinkId(
    id: string
): { from: NodeId; to: NodeId; rel: string; index: number } | null {
    const match = id.match(/^(.+)->(.+)::(.+)::(\d+)$/);
    if (match) {
        return {
            from: match[1],
            to: match[2],
            rel: match[3],
            index: parseInt(match[4], 10)
        };
    }

    const legacy = id.match(/^(.+)→(.+)::(.+)::(\d+)$/);
    if (legacy) {
        return {
            from: legacy[1],
            to: legacy[2],
            rel: legacy[3],
            index: parseInt(legacy[4], 10)
        };
    }

    return null;
}
