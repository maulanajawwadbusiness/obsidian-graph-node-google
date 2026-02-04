/**
 * Stable Hash Utilities
 *
 * Provides deterministic string hashing without crypto dependencies.
 * Uses DJB2 algorithm (simple, fast, sufficient for observability).
 */

/**
 * Compute a simple numeric hash from a string (DJB2 algorithm).
 * Returns a hex string for easy logging.
 *
 * @param str Input string to hash
 * @returns Hexadecimal hash string
 */
export function hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) + char; // hash * 33 + char
    }
    return (hash >>> 0).toString(16).toUpperCase();
}

/**
 * Compute a stable hash from an object via JSON stringification.
 * Sorts object keys to ensure consistent output regardless of key order.
 *
 * @param obj Any JSON-serializable value
 * @returns Hexadecimal hash string
 */
export function hashObject(obj: unknown): string {
    // Canonicalize: sort keys, stable spacing
    const canonical = JSON.stringify(obj, canonicalStringifyReplacer, 0);
    return hashString(canonical);
}

/**
 * JSON replacer that sorts object keys for stable serialization.
 */
function canonicalStringifyReplacer(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Sort object keys
        const sortedKeys = Object.keys(value).sort();
        const sortedObj: Record<string, unknown> = {};
        for (const k of sortedKeys) {
            sortedObj[k] = (value as Record<string, unknown>)[k];
        }
        return sortedObj;
    }
    return value;
}

/**
 * Compute a hash from a topology snapshot (for caching/comparison).
 * Focuses on structure, not metadata.
 *
 * @param nodes Node specs
 * @param links Directed links
 * @returns Hexadecimal hash string
 */
export function hashTopologySnapshot(
    nodes: { id: string }[],
    links: { from: string; to: string }[]
): string {
    // Sort by ID for stability
    const sortedNodeIds = [...nodes].map(n => n.id).sort();
    const sortedLinks = [...links]
        .map(l => `${l.from}->${l.to}`)
        .sort();

    const combined = [...sortedNodeIds, ...sortedLinks].join('|');
    return hashString(combined);
}

/**
 * Truncate a hash string to a specified length (for display).
 *
 * @param hash Full hash string
 * @param maxLength Maximum length (default 8)
 * @returns Truncated hash with ellipsis if needed
 */
export function truncateHash(hash: string, maxLength = 8): string {
    if (hash.length <= maxLength) return hash;
    return hash.slice(0, maxLength) + '…';
}
