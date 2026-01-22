/**
 * Virtual Blocks Hook - Virtualization for large documents
 * Only renders blocks that are visible + overscan area
 */

import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import type { TextBlock } from './documentModel';

const BASE_OVERSCAN_PX = 1400;  // Base pixel overscan above/below viewport
const FAST_OVERSCAN_PX = 2400;  // Overscan during fast scroll
const FAST_SCROLL_PX_PER_MS = 1.5;  // Velocity threshold for fast scroll
const SCROLL_IDLE_MS = 140;
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
    const [heightVersion, setHeightVersion] = useState(0);
    const perfEnabled = typeof window !== 'undefined' && Boolean((window as typeof window & { __DOC_VIEWER_PROFILE__?: boolean }).__DOC_VIEWER_PROFILE__);
    const rangeUpdateCount = useRef(0);
    const lastScrollTop = useRef(0);
    const lastScrollTs = useRef<number | null>(null);
    const isScrolling = useRef(false);
    const idleTimeoutId = useRef<number | null>(null);
    const pendingMeasure = useRef(false);
    const lastOverscanTier = useRef<'base' | 'fast'>('base');

    const measureHeights = useCallback(() => {
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
            setHeightVersion(version => version + 1);
        }
    }, [containerRef, shouldVirtualize]);

    const measuredHeights = useMemo(() => {
        return allBlocks.map(block => blockHeights.current.get(block.blockId) ?? ESTIMATED_BLOCK_HEIGHT);
    }, [allBlocks, heightVersion]);

    const prefixHeights = useMemo(() => {
        const prefix: number[] = new Array(measuredHeights.length + 1);
        prefix[0] = 0;
        for (let i = 0; i < measuredHeights.length; i++) {
            prefix[i + 1] = prefix[i] + measuredHeights[i];
        }
        return prefix;
    }, [measuredHeights]);

    const findIndexForOffset = useCallback((offset: number) => {
        let low = 0;
        let high = prefixHeights.length - 1;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (prefixHeights[mid + 1] <= offset) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    }, [prefixHeights]);

    const updateRange = useCallback((scrollTop: number, viewportHeight: number, overscanPx: number) => {
        const startIndex = findIndexForOffset(Math.max(0, scrollTop - overscanPx));
        const endIndex = Math.min(allBlocks.length, findIndexForOffset(scrollTop + viewportHeight + overscanPx) + 1);

        setVisibleRange(prev => {
            if (prev.start === startIndex && prev.end === endIndex) {
                return prev;
            }
            return { start: startIndex, end: endIndex };
        });
    }, [allBlocks.length, findIndexForOffset]);

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
            const now = performance.now();
            const lastTs = lastScrollTs.current ?? now;
            const dt = Math.max(1, now - lastTs);
            const distance = Math.abs(scrollTop - lastScrollTop.current);
            const velocity = distance / dt;
            const overscanPx = velocity > FAST_SCROLL_PX_PER_MS ? FAST_OVERSCAN_PX : BASE_OVERSCAN_PX;
            const overscanTier = overscanPx === FAST_OVERSCAN_PX ? 'fast' : 'base';

            if (perfEnabled && overscanTier !== lastOverscanTier.current) {
                lastOverscanTier.current = overscanTier;
                console.debug('[DocViewer] overscan tier', {
                    tier: overscanTier,
                    velocityPxPerMs: Number(velocity.toFixed(2)),
                });
            }

            lastScrollTop.current = scrollTop;
            lastScrollTs.current = now;
            isScrolling.current = true;

            if (idleTimeoutId.current) {
                clearTimeout(idleTimeoutId.current);
            }
            idleTimeoutId.current = window.setTimeout(() => {
                isScrolling.current = false;
                if (pendingMeasure.current) {
                    pendingMeasure.current = false;
                    measureHeights();
                }
                const currentScrollTop = container.scrollTop;
                const currentViewportHeight = container.clientHeight;
                updateRange(currentScrollTop, currentViewportHeight, BASE_OVERSCAN_PX);
            }, SCROLL_IDLE_MS);

            updateRange(scrollTop, viewportHeight, overscanPx);
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
            if (idleTimeoutId.current) {
                clearTimeout(idleTimeoutId.current);
            }
        };
    }, [allBlocks, containerRef, findIndexForOffset, measureHeights, perfEnabled, shouldVirtualize, updateRange]);

    // Measure block heights when they render
    useLayoutEffect(() => {
        if (!shouldVirtualize) return;
        if (isScrolling.current) {
            pendingMeasure.current = true;
            return;
        }
        measureHeights();
    }, [measureHeights, shouldVirtualize, visibleRange]);

    useEffect(() => {
        if (!perfEnabled) return;
        rangeUpdateCount.current += 1;
        console.debug('[DocViewer] visible range update', {
            count: rangeUpdateCount.current,
            range: visibleRange,
        });
    }, [perfEnabled, visibleRange]);

    return useMemo(() => {
        if (!shouldVirtualize) {
            return { blocks: allBlocks, topSpacerHeight: 0, bottomSpacerHeight: 0 };
        }

        const visibleBlocks = allBlocks.slice(visibleRange.start, visibleRange.end);
        const topSpacerHeight = prefixHeights[visibleRange.start] ?? 0;
        const totalHeight = prefixHeights[prefixHeights.length - 1] ?? 0;
        const bottomSpacerHeight = Math.max(0, totalHeight - (prefixHeights[visibleRange.end] ?? 0));

        return { blocks: visibleBlocks, topSpacerHeight, bottomSpacerHeight };
    }, [allBlocks, prefixHeights, visibleRange, shouldVirtualize]);
}
