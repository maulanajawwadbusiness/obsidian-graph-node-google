/**
 * Node Document Reference V1
 * Stores references from nodes to character offsets in documents
 */

/**
 * Simple DJB2 hash for text validation
 */
export function djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash.toString(36);
}

export interface NodeDocRefV1 {
    refId: string;              // UUID for this reference
    docId: string;              // References ParsedDocument.id
    normVersion: 1;             // Schema version (always 1 for v1)
    range: {
        start: number;            // Char offset (inclusive)
        end: number;              // Char offset (exclusive)
    };
    kind: 'label' | 'snippet' | 'citation' | 'selection';

    // Optional validation excerpt
    excerpt?: {
        text: string;             // First 32 chars of range
        hash: string;             // DJB2 hash of full range text
    };

    createdAtMs: number;        // Timestamp for staleness detection
}

/**
 * Compute excerpt for validation
 */
export function computeExcerpt(text: string, start: number, end: number): NodeDocRefV1['excerpt'] {
    const slice = text.slice(start, end);
    return {
        text: slice.slice(0, 32),
        hash: djb2Hash(slice),
    };
}
