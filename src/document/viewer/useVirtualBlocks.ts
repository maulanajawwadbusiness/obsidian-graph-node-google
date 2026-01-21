/**
 * Virtual Blocks Hook - Virtualization for large documents
 * Only renders blocks that are visible + overscan area
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import type { TextBlock } from './documentModel';

const OVERSCAN_BLOCKS = 3;  // Blocks to render above/below viewport
const ESTIMATED_BLOCK_HEIGHT = 60;  // Rough estimate for initial layout

export function useVirtualBlocks(
    allBlocks: TextBlock[],
    containerRef: React.RefObject<HTMLElement>
): TextBlock[] {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(20, allBlocks.length) });
    const blockHeights = useRef(new Map<string, number>());

    useEffect(() => {
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
    }, [allBlocks, containerRef]);

    // Measure block heights when they render
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const blocks = container.querySelectorAll('[data-block-id]');
        blocks.forEach(block => {
            const blockId = (block as HTMLElement).dataset.blockId;
            if (blockId) {
                blockHeights.current.set(blockId, block.clientHeight);
            }
        });
    });

    return useMemo(() => {
        return allBlocks.slice(visibleRange.start, visibleRange.end);
    }, [allBlocks, visibleRange]);
}
