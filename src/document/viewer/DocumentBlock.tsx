import React, { useMemo, useEffect } from 'react';
import type { HighlightRange } from '../types';
import { isDocViewerPerfEnabled, recordDocViewerRender } from './docViewerPerf';

const LIST_ITEM_PATTERN = /^(\s*)(\d+\.|[-*])\s+/;
const LIST_INTRO_PATTERN = /:\s*$/;

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

const MAX_RUN_CHARS = 1800;

function pushRun(
    runs: TextRun[],
    start: number,
    end: number,
    className?: string
) {
    for (let pos = start; pos < end; pos += MAX_RUN_CHARS) {
        const chunkEnd = Math.min(end, pos + MAX_RUN_CHARS);
        runs.push({ start: pos, end: chunkEnd, className });
    }
}

function buildRuns(text: string, blockStart: number, highlights?: HighlightRange[]): TextRun[] {
    if (!highlights || highlights.length === 0) {
        const runs: TextRun[] = [];
        pushRun(runs, 0, text.length);
        return runs;
    }

    // Build runs by splitting at highlight boundaries
    const boundaries = new Set<number>([0, text.length]);

    for (const highlight of highlights) {
        const localStart = Math.max(0, highlight.start - blockStart);
        const localEnd = Math.min(text.length, highlight.end - blockStart);
        boundaries.add(localStart);
        boundaries.add(localEnd);
    }

    const sorted = Array.from(boundaries).sort((a, b) => a - b);
    const runs: TextRun[] = [];
    let highlightIndex = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        const runStart = sorted[i];
        const runEnd = sorted[i + 1];
        const globalStart = blockStart + runStart;
        const globalEnd = blockStart + runEnd;

        while (highlightIndex < highlights.length && highlights[highlightIndex].end <= globalStart) {
            highlightIndex += 1;
        }

        let activeHighlight: HighlightRange | undefined;
        for (let scan = highlightIndex; scan < highlights.length && highlights[scan].start <= globalStart; scan += 1) {
            const candidate = highlights[scan];
            if (candidate.end >= globalEnd) {
                if (!activeHighlight || candidate.id === 'active') {
                    activeHighlight = candidate;
                    if (candidate.id === 'active') break;
                }
            }
        }

        const className = activeHighlight
            ? (activeHighlight.id === 'active' ? 'highlight-active' : 'highlight-other')
            : undefined;

        pushRun(runs, runStart, runEnd, className);
    }

    return runs;
}

const DocumentBlockComponent: React.FC<DocumentBlockProps> = ({
    blockId,
    start,
    end,
    text,
    highlights
}) => {
    const perfEnabled = isDocViewerPerfEnabled();
    const runs = useMemo(
        () => buildRuns(text, start, highlights),
        [text, start, highlights]
    );

    const isListItem = LIST_ITEM_PATTERN.test(text);
    const isListIntro = !isListItem && LIST_INTRO_PATTERN.test(text);

    const blockClassName = [
        isListItem && 'dv-list-item',
        isListIntro && 'dv-list-intro',
    ].filter(Boolean).join(' ') || undefined;

    useEffect(() => {
        if (!perfEnabled) return;
        recordDocViewerRender('block');
    });

    return (
        <p
            data-block-id={blockId}
            data-start={start}
            data-end={end}
            className={blockClassName}
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

export const DocumentBlock = React.memo(DocumentBlockComponent);
