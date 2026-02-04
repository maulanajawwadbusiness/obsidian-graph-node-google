/**
 * Compute link diff between before and after states.
 * Returns truncated arrays (first 10 items) with full counts.
 * 
 * STEP6-RUN4: Helper for patchTopology event emission.
 */
function computeLinkDiff(
    linksBefore: DirectedLink[],
    linksAfter: DirectedLink[]
): import('./topologyMutationObserver').LinkDiff {
    const beforeIds = new Set(linksBefore.map(l => l.id).filter(Boolean));
    const afterIds = new Set(linksAfter.map(l => l.id).filter(Boolean));

    const added: string[] = [];
    const removed: string[] = [];
    const updated: string[] = [];

    // Find added links
    for (const link of linksAfter) {
        if (link.id && !beforeIds.has(link.id)) {
            added.push(link.id);
        }
    }

    // Find removed links
    for (const link of linksBefore) {
        if (link.id && !afterIds.has(link.id)) {
            removed.push(link.id);
        }
    }

    // Find updated links (same ID, different content)
    const beforeMap = new Map(linksBefore.map(l => [l.id, l]).filter(([id]) => id));
    const afterMap = new Map(linksAfter.map(l => [l.id, l]).filter(([id]) => id));

    for (const [id, afterLink] of afterMap) {
        const beforeLink = beforeMap.get(id);
        if (beforeLink && (
            beforeLink.from !== afterLink.from ||
            beforeLink.to !== afterLink.to ||
            beforeLink.weight !== afterLink.weight ||
            beforeLink.kind !== afterLink.kind ||
            beforeLink.rel !== afterLink.rel
        )) {
            updated.push(id as string);
        }
    }

    return {
        added: added.slice(0, 10),
        removed: removed.slice(0, 10),
        updated: updated.slice(0, 10),
        addedCount: added.length,
        removedCount: removed.length,
        updatedCount: updated.length
    };
}
