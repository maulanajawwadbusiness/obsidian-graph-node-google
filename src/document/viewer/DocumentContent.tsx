import React, { useMemo, useRef, useEffect, useState } from 'react';
import { createBlockBuilder, type TextBlock } from './documentModel';
import { DocumentBlock } from './DocumentBlock';
import type { HighlightRange } from '../types';
import { useVirtualBlocks } from './useVirtualBlocks';
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
    const [blocks, setBlocks] = useState<TextBlock[]>([]);
    const [isHydrating, setIsHydrating] = useState(false);
    renderCountRef.current += 1;

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    useEffect(() => {
        buildTokenRef.current += 1;
        if (!text) {
            builderRef.current = null;
            setBlocks([]);
            setIsHydrating(false);
            firstChunkDoneRef.current = false;
            firstPaintMarkedRef.current = false;
            return;
        }

        markDocViewerPerf('normalize_done');

        const cached = docId ? docBlockCache.get(docId) : null;
        if (cached) {
            setBlocks(cached);
            setIsHydrating(false);
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
        setBlocks([]);
        setIsHydrating(true);

        const scheduleChunk = (isFirstChunk: boolean) => {
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
                const maxBlocks = isFirstChunk ? estimatedBlocks : CHUNK_BLOCK_LIMIT;
                const budget = isFirstChunk ? FIRST_CHUNK_TIME_BUDGET_MS : HYDRATE_CHUNK_TIME_BUDGET_MS;
                const chunk = builder.nextChunk(maxBlocks, budget);

                if (chunk.blocks.length > 0) {
                    setBlocks(prev => {
                        const nextBlocks = prev.concat(chunk.blocks);
                        return nextBlocks;
                    });
                }

                if (!firstChunkDoneRef.current && chunk.blocks.length > 0) {
                    firstChunkDoneRef.current = true;
                    markDocViewerPerf('block_build_first_chunk_done');
                }

                if (chunk.done) {
                    setIsHydrating(false);
                    if (docId) {
                        const finalBlocks = blocksRef.current.concat(chunk.blocks);
                        docBlockCache.set(docId, finalBlocks);
                    }
                    markDocViewerPerf('hydrate_done');
                    reportDocViewerPerf();
                    buildScheduledRef.current = false;
                } else {
                    buildScheduledRef.current = false;
                    scheduleChunk(false);
                }
            };

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(runChunk);
            } else {
                window.setTimeout(runChunk, 0);
            }
        };

        scheduleChunk(true);
    }, [containerRef, docId, text]);
    const { blocks: visibleBlocks, topSpacerHeight, bottomSpacerHeight } = useVirtualBlocks(
        blocks,
        containerRef,
        layoutVersion
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
                <DocumentBlock
                    key={block.blockId}
                    blockId={block.blockId}
                    start={block.start}
                    end={block.end}
                    text={block.text}
                    highlights={blockHighlights?.get(block.blockId)}
                />
            ))}
            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
        </div>
    );
};
