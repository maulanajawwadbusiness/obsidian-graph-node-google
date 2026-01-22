/**
 * Virtual Blocks Hook - Virtualization for large documents
 * Only renders blocks that are visible + overscan area
 */

import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import type { TextBlock } from './documentModel';

const OVERSCAN_PX = 1000;
const RANGE_IDLE_RESET_MS = 120;
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
    const lastRangeRef = useRef(visibleRange);
    const scrollingRef = useRef(false);
    const idleTimerRef = useRef<number | null>(null);
    const heightUpdateRafRef = useRef<number | null>(null);
    const hasLoggedEmptyRef = useRef(false);

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
            const overscanStart = Math.max(0, scrollTop - OVERSCAN_PX);
            const overscanEnd = scrollTop + viewportHeight + OVERSCAN_PX;
            const startIndex = findIndexForOffset(overscanStart);
            const endIndex = Math.min(allBlocks.length, findIndexForOffset(overscanEnd) + 1);

            const nextRange = { start: startIndex, end: endIndex };
            const previousRange = lastRangeRef.current;
            const unionRange = {
                start: Math.min(previousRange.start, nextRange.start),
                end: Math.max(previousRange.end, nextRange.end),
            };

            scrollingRef.current = true;
            if (idleTimerRef.current) {
                window.clearTimeout(idleTimerRef.current);
            }
            idleTimerRef.current = window.setTimeout(() => {
                scrollingRef.current = false;
                setVisibleRange(current => {
                    const settled = lastRangeRef.current;
                    if (current.start === settled.start && current.end === settled.end) {
                        return current;
                    }
                    return settled;
                });
            }, RANGE_IDLE_RESET_MS);

            const renderRange = scrollingRef.current ? unionRange : nextRange;
            lastRangeRef.current = nextRange;

            setVisibleRange(prev => {
                if (prev.start === renderRange.start && prev.end === renderRange.end) {
                    return prev;
                }
                return renderRange;
            });

            if (perfEnabled) {
                console.debug('[DocViewer] range compute', {
                    scrollTop,
                    rangeStart: renderRange.start,
                    rangeEnd: renderRange.end,
                    renderedCount: renderRange.end - renderRange.start,
                });
            }
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
            if (idleTimerRef.current) {
                window.clearTimeout(idleTimerRef.current);
            }
            if (heightUpdateRafRef.current) {
                cancelAnimationFrame(heightUpdateRafRef.current);
            }
        };
    }, [allBlocks, containerRef, findIndexForOffset, perfEnabled, shouldVirtualize]);

    // Measure block heights when they render
    useLayoutEffect(() => {
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
            if (heightUpdateRafRef.current) {
                cancelAnimationFrame(heightUpdateRafRef.current);
            }
            heightUpdateRafRef.current = requestAnimationFrame(() => {
                heightUpdateRafRef.current = null;
                if (scrollingRef.current) {
                    if (idleTimerRef.current) {
                        window.clearTimeout(idleTimerRef.current);
                    }
                    idleTimerRef.current = window.setTimeout(() => {
                        setHeightVersion(version => version + 1);
                    }, RANGE_IDLE_RESET_MS);
                    return;
                }
                setHeightVersion(version => version + 1);
            });
        }
    }, [containerRef, shouldVirtualize, visibleRange]);

    useEffect(() => {
        if (!perfEnabled) return;
        rangeUpdateCount.current += 1;
        const renderedCount = visibleRange.end - visibleRange.start;
        console.debug('[DocViewer] visible range update', {
            count: rangeUpdateCount.current,
            range: visibleRange,
        });
        if (renderedCount === 0 && !hasLoggedEmptyRef.current) {
            console.warn('[DocViewer] empty render window detected', {
                range: visibleRange,
            });
            hasLoggedEmptyRef.current = true;
        } else if (renderedCount > 0) {
            hasLoggedEmptyRef.current = false;
        }
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
