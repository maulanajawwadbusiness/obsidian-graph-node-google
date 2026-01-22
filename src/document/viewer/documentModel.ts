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

export interface BlockBuildChunk {
    blocks: TextBlock[];
    done: boolean;
}

export interface BlockBuilder {
    nextChunk: (maxBlocks: number, timeBudgetMs: number) => BlockBuildChunk;
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
    for (const line of lines) {
        const start = offset;
        const end = offset + line.length;

        blocks.push({
            blockId: `b${start}`,
            start,
            end: Math.min(end, text.length), // Don't exceed text length
            text: line,
        });

        offset = end + 1;
    }

    return blocks;
}

/**
 * Progressive block builder for large documents.
 * Processes the text incrementally to avoid long main-thread stalls.
 */
export function createBlockBuilder(text: string): BlockBuilder {
    let cursor = 0;
    let offset = 0;
    const length = text.length;

    const nextChunk = (maxBlocks: number, timeBudgetMs: number): BlockBuildChunk => {
        const blocks: TextBlock[] = [];
        const startTime = performance.now();

        while (cursor <= length && blocks.length < maxBlocks) {
            if (performance.now() - startTime > timeBudgetMs) {
                break;
            }

            const lineEnd = text.indexOf('\n', cursor);
            const endIndex = lineEnd === -1 ? length : lineEnd;
            const lineText = text.slice(cursor, endIndex);
            const start = offset;
            const end = offset + lineText.length;

            blocks.push({
                blockId: `b${start}`,
                start,
                end: Math.min(end, length),
                text: lineText,
            });

            offset = end + 1;
            if (lineEnd === -1) {
                cursor = length + 1;
                break;
            }
            cursor = lineEnd + 1;
        }

        return { blocks, done: cursor > length };
    };

    return { nextChunk };
}
