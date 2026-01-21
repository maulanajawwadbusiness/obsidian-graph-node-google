/**
 * Document Model - Text blocks with stable character offsets
 * The canonical text is split into blocks (paragraphs) for rendering
 */

export interface TextBlock {
    blockId: string;           // Stable ID for React keys
    start: number;             // Global char offset (inclusive)
    end: number;               // Global char offset (exclusive)
    text: string;              // Slice of canonicalText[start:end]
}

/**
 * Split canonicalText into blocks (paragraphs).
 * Blocks are defined by newline boundaries.
 */
export function buildBlocks(text: string): TextBlock[] {
    if (!text) return [];

    const blocks: TextBlock[] = [];
    const lines = text.split('\n');
    let offset = 0;
    let id = 0;

    for (const line of lines) {
        const start = offset;
        const end = offset + line.length + 1; // +1 for the newline

        blocks.push({
            blockId: `b${id++}`,
            start,
            end: Math.min(end, text.length), // Don't exceed text length
            text: line,
        });

        offset = end;
    }

    return blocks;
}
