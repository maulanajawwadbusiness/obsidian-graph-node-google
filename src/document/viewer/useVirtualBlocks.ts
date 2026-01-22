/**
 * Virtual Blocks Hook - Virtualization for large documents
 * Only renders blocks that are visible + overscan area
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import type { TextBlock } from './documentModel';

const OVERSCAN_BLOCKS = 3;  // Blocks to render above/below viewport
const ESTIMATED_BLOCK_HEIGHT = 60;  // Rough estimate for initial layout
const VIRTUALIZE_THRESHOLD = 50;

export interface VirtualBlocksResult {
    blocks: TextBlock[];
    topSpacerHeight: number;
    bottomSpacerHeight: number;
}

export function useVirtualBlocks(
    allBlocks: TextBlock[],
    containerRef: React.RefObject<HTMLElement>
): VirtualBlocksResult {
    const shouldVirtualize = allBlocks.length >= VIRTUALIZE_THRESHOLD;
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(20, allBlocks.length) });
    const blockHeights = useRef(new Map<string, number>());

    useEffect(() => {
        if (!shouldVirtualize) {
            setVisibleRange({ start: 0, end: allBlocks.length });
            return;
        }
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const viewportHeight = container.clientHeight;

            // Calculate which blocks are visible
            let cumulativeHeight = 0;
            let startIndex = 0;
            let endIndex = allBlocks.length;

            for (let i = 0; i < allBlocks.length; i++) {
                const height = blockHeights.current.get(allBlocks[i].blockId) || ESTIMATED_BLOCK_HEIGHT;

                if (cumulativeHeight + height < scrollTop && startIndex === i) {
                    startIndex = i + 1;
                }

                if (cumulativeHeight > scrollTop + viewportHeight && endIndex === allBlocks.length) {
                    endIndex = i;
                    break;
                }

                cumulativeHeight += height;
            }

            // Apply overscan
            const finalStart = Math.max(0, startIndex - OVERSCAN_BLOCKS);
            const finalEnd = Math.min(allBlocks.length, endIndex + OVERSCAN_BLOCKS);

            setVisibleRange({ start: finalStart, end: finalEnd });
        };

        // Initial calculation
        handleScroll();

        // Throttled scroll listener
        let rafId: number | null = null;
        const throttledScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                handleScroll();
            });
        };

        container.addEventListener('scroll', throttledScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', throttledScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [allBlocks, containerRef, shouldVirtualize]);

    // Measure block heights when they render
    useEffect(() => {
        if (!shouldVirtualize) return;
        const container = containerRef.current;
        if (!container) return;

        const blocks = container.querySelectorAll('[data-block-id]');
        let changed = false;
        blocks.forEach(block => {
            const blockId = (block as HTMLElement).dataset.blockId;
            if (blockId) {
                const measured = block.clientHeight;
                if (blockHeights.current.get(blockId) !== measured) {
                    blockHeights.current.set(blockId, measured);
                    changed = true;
                }
            }
        });
        if (changed) {
            setVisibleRange(range => ({ ...range }));
        }
    });

    return useMemo(() => {
        if (!shouldVirtualize) {
            return { blocks: allBlocks, topSpacerHeight: 0, bottomSpacerHeight: 0 };
        }

        const visibleBlocks = allBlocks.slice(visibleRange.start, visibleRange.end);
        let topSpacerHeight = 0;
        let bottomSpacerHeight = 0;

        for (let i = 0; i < visibleRange.start; i++) {
            const block = allBlocks[i];
            topSpacerHeight += blockHeights.current.get(block.blockId) || ESTIMATED_BLOCK_HEIGHT;
        }

        for (let i = visibleRange.end; i < allBlocks.length; i++) {
            const block = allBlocks[i];
            bottomSpacerHeight += blockHeights.current.get(block.blockId) || ESTIMATED_BLOCK_HEIGHT;
        }

        return { blocks: visibleBlocks, topSpacerHeight, bottomSpacerHeight };
    }, [allBlocks, visibleRange, shouldVirtualize]);
}
