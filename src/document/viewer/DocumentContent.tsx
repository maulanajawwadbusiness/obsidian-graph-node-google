import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createBlockBuilder, type TextBlock } from './documentModel';
import { DocumentBlock } from './DocumentBlock';
import type { HighlightRange } from '../types';
import { useVirtualBlocks, type VirtualizedBlock } from './useVirtualBlocks';
import { isDocViewerPerfEnabled, markDocViewerPerf, recordDocViewerRender, reportDocViewerPerf } from './docViewerPerf';

/**
 * DocumentContent - Renders the document text as blocks
 * (Non-virtualized for v1 - virtualization added in Run 7)
 */

export interface DocumentContentProps {
    text: string;
    highlights?: HighlightRange[];
    containerRef: React.RefObject<HTMLElement>;
    layoutVersion?: string;
    docId?: string;
}

type HighlightMap = Map<string, HighlightRange[]>;

const ESTIMATED_BLOCK_HEIGHT = 60;
const FIRST_CHUNK_MIN_BLOCKS = 30;
const CHUNK_BLOCK_LIMIT = 300;
const FIRST_CHUNK_TIME_BUDGET_MS = 10;
const HYDRATE_CHUNK_TIME_BUDGET_MS = 12;
const PRIORITY_CHUNK_BLOCK_LIMIT = 700;
const PRIORITY_CHUNK_TIME_BUDGET_MS = 28;
const PRIORITY_BUILD_WINDOW_MS = 1800;
const PLACEHOLDER_SEGMENT_BLOCKS = 20;

const docBlockCache = new Map<string, TextBlock[]>();

export const DocumentContent: React.FC<DocumentContentProps> = ({
    text,
    highlights,
    containerRef,
    layoutVersion,
    docId
}) => {
    const perfEnabled = isDocViewerPerfEnabled();
    const renderCountRef = useRef(0);
    const builderRef = useRef<ReturnType<typeof createBlockBuilder> | null>(null);
    const buildScheduledRef = useRef(false);
    const firstChunkDoneRef = useRef(false);
    const firstPaintMarkedRef = useRef(false);
    const blocksRef = useRef<TextBlock[]>([]);
    const buildTokenRef = useRef(0);
    const priorityUntilRef = useRef(0);
    const scheduleChunkRef = useRef<((isFirstChunk: boolean, forcePriority?: boolean) => void) | null>(null);
    const estimatedTotalBlocksRef = useRef<number | null>(null);
    const [hydrationState, setHydrationState] = useState<{
        blocks: TextBlock[];
        isHydrating: boolean;
        estimatedTotalBlocks: number | null;
    }>({
        blocks: [],
        isHydrating: false,
        estimatedTotalBlocks: null,
    });
    const { blocks, isHydrating, estimatedTotalBlocks } = hydrationState;
    renderCountRef.current += 1;

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    useEffect(() => {
        estimatedTotalBlocksRef.current = estimatedTotalBlocks;
    }, [estimatedTotalBlocks]);

    const requestHydrationPriority = useCallback(() => {
        priorityUntilRef.current = performance.now() + PRIORITY_BUILD_WINDOW_MS;
        scheduleChunkRef.current?.(false, true);
    }, []);

    useEffect(() => {
        buildTokenRef.current += 1;
        if (!text) {
            builderRef.current = null;
            setHydrationState({
                blocks: [],
                isHydrating: false,
                estimatedTotalBlocks: null,
            });
            priorityUntilRef.current = 0;
            scheduleChunkRef.current = null;
            firstChunkDoneRef.current = false;
            firstPaintMarkedRef.current = false;
            return;
        }

        markDocViewerPerf('normalize_done');

        const cached = docId ? docBlockCache.get(docId) : null;
        if (cached) {
            setHydrationState({
                blocks: cached,
                isHydrating: false,
                estimatedTotalBlocks: cached.length,
            });
            priorityUntilRef.current = 0;
            scheduleChunkRef.current = null;
            firstChunkDoneRef.current = true;
            firstPaintMarkedRef.current = false;
            markDocViewerPerf('block_build_first_chunk_done');
            markDocViewerPerf('hydrate_done');
            reportDocViewerPerf();
            return;
        }

        builderRef.current = createBlockBuilder(text);
        buildScheduledRef.current = false;
        firstChunkDoneRef.current = false;
        firstPaintMarkedRef.current = false;
        setHydrationState({
            blocks: [],
            isHydrating: true,
            estimatedTotalBlocks: null,
        });
        priorityUntilRef.current = 0;

        const scheduleChunk = (isFirstChunk: boolean, forcePriority = false) => {
            if (buildScheduledRef.current) return;
            buildScheduledRef.current = true;
            const buildToken = buildTokenRef.current;

            const runChunk = () => {
                if (buildTokenRef.current !== buildToken) {
                    buildScheduledRef.current = false;
                    return;
                }
                const builder = builderRef.current;
                if (!builder) {
                    buildScheduledRef.current = false;
                    return;
                }

                const viewportHeight = containerRef.current?.clientHeight ?? 0;
                const estimatedBlocks = viewportHeight
                    ? Math.ceil(viewportHeight / ESTIMATED_BLOCK_HEIGHT) + FIRST_CHUNK_MIN_BLOCKS
                    : FIRST_CHUNK_MIN_BLOCKS;
                const isPriority = forcePriority || performance.now() < priorityUntilRef.current;
                const maxBlocks = isFirstChunk
                    ? estimatedBlocks
                    : (isPriority ? PRIORITY_CHUNK_BLOCK_LIMIT : CHUNK_BLOCK_LIMIT);
                const budget = isFirstChunk
                    ? FIRST_CHUNK_TIME_BUDGET_MS
                    : (isPriority ? PRIORITY_CHUNK_TIME_BUDGET_MS : HYDRATE_CHUNK_TIME_BUDGET_MS);
                const chunk = builder.nextChunk(maxBlocks, budget);
                const nextBlocks = chunk.blocks.length > 0
                    ? blocksRef.current.concat(chunk.blocks)
                    : blocksRef.current;
                let nextEstimate = estimatedTotalBlocksRef.current;

                if (!firstChunkDoneRef.current && chunk.blocks.length > 0) {
                    firstChunkDoneRef.current = true;
                    markDocViewerPerf('block_build_first_chunk_done');
                    const totalChars = text.length + 1;
                    const totalSampled = chunk.blocks.reduce((sum, block) => sum + Math.max(1, block.text.length + 1), 0);
                    const avgChars = totalSampled > 0 ? totalSampled / chunk.blocks.length : Math.max(1, totalChars);
                    const estimate = Math.max(chunk.blocks.length, Math.ceil(totalChars / avgChars));
                    nextEstimate = Math.max(estimate, nextBlocks.length);
                }
                if (nextEstimate === null || nextBlocks.length > nextEstimate) {
                    nextEstimate = nextBlocks.length;
                }
                if (chunk.done) {
                    nextEstimate = nextBlocks.length;
                }

                setHydrationState({
                    blocks: nextBlocks,
                    isHydrating: !chunk.done,
                    estimatedTotalBlocks: nextEstimate,
                });

                if (chunk.done) {
                    if (docId) {
                        docBlockCache.set(docId, nextBlocks);
                    }
                    markDocViewerPerf('hydrate_done');
                    reportDocViewerPerf();
                    buildScheduledRef.current = false;
                } else {
                    buildScheduledRef.current = false;
                    scheduleChunk(false, isPriority);
                }
            };

            const win = window as Window & { requestIdleCallback?: typeof requestIdleCallback };
            if (!forcePriority && win.requestIdleCallback) {
                win.requestIdleCallback(runChunk);
            } else {
                win.setTimeout(runChunk, 0);
            }
        };

        scheduleChunkRef.current = scheduleChunk;
        scheduleChunk(true);
    }, [containerRef, docId, text]);
    const renderBlocks = useMemo<VirtualizedBlock[]>(() => {
        if (!isHydrating || !estimatedTotalBlocks || blocks.length === 0) {
            return blocks;
        }
        const remaining = estimatedTotalBlocks - blocks.length;
        if (remaining <= 0) {
            return blocks;
        }
        const segmentSize = PLACEHOLDER_SEGMENT_BLOCKS;
        const placeholders: VirtualizedBlock[] = [];
        const firstSegmentIndex = Math.floor(blocks.length / segmentSize);
        const firstSegmentStart = blocks.length;
        const firstSegmentEnd = Math.min(estimatedTotalBlocks, (firstSegmentIndex + 1) * segmentSize);
        const firstSegmentCount = Math.max(0, firstSegmentEnd - firstSegmentStart);
        if (firstSegmentCount > 0) {
            placeholders.push({
                blockId: `ph-${firstSegmentIndex}`,
                start: -1,
                end: -1,
                text: '',
                kind: 'placeholder',
                estimatedHeight: Math.max(ESTIMATED_BLOCK_HEIGHT, firstSegmentCount * ESTIMATED_BLOCK_HEIGHT),
            });
        }
        for (let segmentIndex = firstSegmentIndex + 1; segmentIndex * segmentSize < estimatedTotalBlocks; segmentIndex += 1) {
            const segmentStart = segmentIndex * segmentSize;
            const segmentEnd = Math.min(estimatedTotalBlocks, segmentStart + segmentSize);
            const segmentCount = Math.max(0, segmentEnd - segmentStart);
            if (segmentCount <= 0) continue;
            placeholders.push({
                blockId: `ph-${segmentIndex}`,
                start: -1,
                end: -1,
                text: '',
                kind: 'placeholder',
                estimatedHeight: Math.max(ESTIMATED_BLOCK_HEIGHT, segmentCount * ESTIMATED_BLOCK_HEIGHT),
            });
        }
        return blocks.concat(placeholders);
    }, [blocks, estimatedTotalBlocks, isHydrating]);

    const { blocks: visibleBlocks, topSpacerHeight, bottomSpacerHeight } = useVirtualBlocks(
        renderBlocks,
        containerRef,
        layoutVersion,
        { isHydrating, onSeekIntent: requestHydrationPriority }
    );

    const sortedHighlights = useMemo(() => {
        if (isHydrating) return null;
        if (!highlights || highlights.length === 0) return null;
        return [...highlights].sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return a.end - b.end;
        });
    }, [highlights, isHydrating]);

    const blockHighlights = useMemo<HighlightMap | null>(() => {
        if (!sortedHighlights || sortedHighlights.length === 0) return null;
        const map: HighlightMap = new Map();
        let highlightIndex = 0;

        for (const block of blocks) {
            while (highlightIndex < sortedHighlights.length && sortedHighlights[highlightIndex].end <= block.start) {
                highlightIndex += 1;
            }

            const blockRanges: HighlightRange[] = [];
            for (let scan = highlightIndex; scan < sortedHighlights.length; scan += 1) {
                const highlight = sortedHighlights[scan];
                if (highlight.start >= block.end) break;
                if (highlight.end > block.start) {
                    blockRanges.push(highlight);
                }
            }

            if (blockRanges.length > 0) {
                map.set(block.blockId, blockRanges);
            }
        }

        return map;
    }, [blocks, sortedHighlights]);

    const contentWrapperStyle = useMemo<React.CSSProperties>(() => ({
        fontFamily: 'var(--doc-font-family)',
        fontSize: 'var(--doc-font-size, 13px)',
        lineHeight: 'var(--doc-line-height, 1.65)',
        fontWeight: 'var(--doc-font-weight)',
        color: 'var(--doc-text)',
        maxWidth: 'var(--doc-max-line-width, 68ch)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
    }), []);

    useEffect(() => {
        if (!perfEnabled) return;
        recordDocViewerRender('content');
        console.debug('[DocViewer] DocumentContent render', {
            count: renderCountRef.current,
            visibleBlocks: visibleBlocks.length,
        });
    }, [perfEnabled, visibleBlocks.length]);

    useEffect(() => {
        if (!firstChunkDoneRef.current) return;
        if (blocks.length === 0) return;
        if (!firstPaintMarkedRef.current) {
            firstPaintMarkedRef.current = true;
            markDocViewerPerf('first_paint_committed');
        }
    }, [blocks.length]);

    return (
        <div style={contentWrapperStyle}>
            {blocks.length === 0 && text && (
                <div className="dv-document-loading">Loading document…</div>
            )}
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
            {visibleBlocks.map(block => (
                block.kind === 'placeholder' ? (
                    <div
                        key={block.blockId}
                        className="dv-block-placeholder"
                        data-block-id={block.blockId}
                        style={{ height: block.estimatedHeight ?? ESTIMATED_BLOCK_HEIGHT }}
                    />
                ) : (
                    <DocumentBlock
                        key={block.blockId}
                        blockId={block.blockId}
                        start={block.start}
                        end={block.end}
                        text={block.text}
                        highlights={blockHighlights?.get(block.blockId)}
                    />
                )
            ))}
            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
        </div>
    );
};
