import React, { useMemo } from 'react';
import type { HighlightRange } from '../types';

/**
 * DocumentBlock - Individual paragraph/block renderer with highlight support
 * Renders a single TextBlock with data-start and data-end attributes
 * Splits text into runs based on highlight ranges
 */

export interface DocumentBlockProps {
    blockId: string;
    start: number;
    end: number;
    text: string;
    highlights?: HighlightRange[];
}

interface TextRun {
    start: number;  // Within-block offset
    end: number;    // Within-block offset
    className?: string;
}

function buildRuns(text: string, blockStart: number, blockEnd: number, highlights?: HighlightRange[]): TextRun[] {
    if (!highlights || highlights.length === 0) {
        return [{ start: 0, end: text.length }];
    }

    // Find highlights that intersect this block
    const relevant = highlights.filter(h =>
        h.start < blockEnd && h.end > blockStart
    );

    if (relevant.length === 0) {
        return [{ start: 0, end: text.length }];
    }

    // Build runs by splitting at highlight boundaries
    const boundaries = new Set<number>([0, text.length]);

    for (const highlight of relevant) {
        const localStart = Math.max(0, highlight.start - blockStart);
        const localEnd = Math.min(text.length, highlight.end - blockStart);
        boundaries.add(localStart);
        boundaries.add(localEnd);
    }

    const sorted = Array.from(boundaries).sort((a, b) => a - b);
    const runs: TextRun[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
        const runStart = sorted[i];
        const runEnd = sorted[i + 1];
        const globalStart = blockStart + runStart;
        const globalEnd = blockStart + runEnd;

        // Find if this run is highlighted
        const highlight = relevant.find(h =>
            h.start <= globalStart && h.end >= globalEnd
        );

        runs.push({
            start: runStart,
            end: runEnd,
            className: highlight
                ? (highlight.id === 'active' ? 'highlight-active' : 'highlight-other')
                : undefined,
        });
    }

    return runs;
}

export const DocumentBlock: React.FC<DocumentBlockProps> = ({
    blockId,
    start,
    end,
    text,
    highlights
}) => {
    const runs = useMemo(
        () => buildRuns(text, start, end, highlights),
        [text, start, end, highlights]
    );

    const blockStyle: React.CSSProperties = {
        marginBottom: 'var(--doc-paragraph-gap, 0.75em)',
    };

    return (
        <p
            data-block-id={blockId}
            data-start={start}
            data-end={end}
            style={blockStyle}
        >
            {runs.map((run) => (
                <span
                    key={`${blockId}-${run.start}`}
                    data-start={start + run.start}
                    data-end={start + run.end}
                    className={run.className}
                >
                    {text.slice(run.start, run.end)}
                </span>
            ))}
        </p>
    );
};
