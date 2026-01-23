/**
 * Virtual Blocks Hook - Virtualization for large documents
 * Only renders blocks that are visible + overscan area
 */

import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import type { TextBlock } from './documentModel';
import {
    flushDocViewerPerf,
    isDocViewerPerfEnabled,
    recordDocViewerRangeUpdate,
    setDocViewerScrolling,
} from './docViewerPerf';

const BASE_OVERSCAN_PX = 1400;  // Base pixel overscan above/below viewport
const FAST_OVERSCAN_PX = 2400;  // Overscan during fast scroll
const FAST_SCROLL_PX_PER_MS = 1.5;  // Velocity threshold for fast scroll
const SCROLL_IDLE_MS = 140;
const RESIZE_IDLE_MS = 200;
const LAYOUT_IDLE_MS = 180;
const ESTIMATED_BLOCK_HEIGHT = 60;  // Rough estimate for initial layout
const VIRTUALIZE_THRESHOLD = 50;
const BASE_OVERSCAN_VIEWPORT_MULTIPLIER = 1.5;
const FAST_OVERSCAN_VIEWPORT_MULTIPLIER = 2.5;

export interface VirtualBlocksResult {
    blocks: TextBlock[];
    topSpacerHeight: number;
    bottomSpacerHeight: number;
}

export function useVirtualBlocks(
    allBlocks: TextBlock[],
    containerRef: React.RefObject<HTMLElement>,
    layoutVersion?: string
): VirtualBlocksResult {
    const shouldVirtualize = allBlocks.length >= VIRTUALIZE_THRESHOLD;
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(20, allBlocks.length) });
    const visibleRangeRef = useRef(visibleRange);
    const blockHeights = useRef(new Map<string, number>());
    const [heightVersion, setHeightVersion] = useState(0);
    const perfEnabled = isDocViewerPerfEnabled();
    const rangeUpdateCount = useRef(0);
    const lastScrollTop = useRef(0);
    const lastScrollTs = useRef<number | null>(null);
    const isScrolling = useRef(false);
    const idleTimeoutId = useRef<number | null>(null);
    const pendingMeasure = useRef(false);
    const lastOverscanTier = useRef<'base' | 'fast'>('base');
    const frameIdRef = useRef(0);
    const frameUpdateCountRef = useRef(0);
    const lastRangeFrameRef = useRef(0);
    const hasLoggedEmptyRef = useRef(false);
    const viewportHeightRef = useRef(0);
    const prevPrefixHeightsRef = useRef<number[]>([]);
    const lastBlocksSignatureRef = useRef('');
    const resizeIdleTimeoutId = useRef<number | null>(null);
    const layoutIdleTimeoutId = useRef<number | null>(null);
    const resizeRafIdRef = useRef<number | null>(null);
    const isResizing = useRef(false);
    const lastLayoutVersionRef = useRef<string | undefined>(layoutVersion);

    useEffect(() => {
        visibleRangeRef.current = visibleRange;
    }, [visibleRange]);

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

    const getOverscanPx = useCallback((velocity: number, viewportHeight: number) => {
        const baseOverscan = Math.max(BASE_OVERSCAN_PX, viewportHeight * BASE_OVERSCAN_VIEWPORT_MULTIPLIER);
        const fastOverscan = Math.max(FAST_OVERSCAN_PX, viewportHeight * FAST_OVERSCAN_VIEWPORT_MULTIPLIER);
        return velocity > FAST_SCROLL_PX_PER_MS ? fastOverscan : baseOverscan;
    }, []);

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

    const updateRange = useCallback((scrollTop: number, viewportHeight: number, overscanPx: number, frameId?: number) => {
        const startIndex = findIndexForOffset(Math.max(0, scrollTop - overscanPx));
        const endIndex = Math.min(allBlocks.length, findIndexForOffset(scrollTop + viewportHeight + overscanPx) + 1);
        const nextRange = { start: startIndex, end: endIndex };
        const prevRange = visibleRangeRef.current;
        if (prevRange.start === nextRange.start && prevRange.end === nextRange.end) {
            return false;
        }
        visibleRangeRef.current = nextRange;
        setVisibleRange(nextRange);
        rangeUpdateCount.current += 1;

        if (perfEnabled) {
            const frameKey = frameId ?? 0;
            if (frameKey !== lastRangeFrameRef.current) {
                lastRangeFrameRef.current = frameKey;
                frameUpdateCountRef.current = 0;
            }
            frameUpdateCountRef.current += 1;
            recordDocViewerRangeUpdate(frameUpdateCountRef.current);
        }

        return true;
    }, [allBlocks.length, findIndexForOffset, perfEnabled]);

    const scheduleIdleRemeasure = useCallback((idleTimeoutRef: { current: number | null }) => {
        if (idleTimeoutRef.current) {
            clearTimeout(idleTimeoutRef.current);
        }
        idleTimeoutRef.current = window.setTimeout(() => {
            if (isScrolling.current || isResizing.current) {
                pendingMeasure.current = true;
                return;
            }
            pendingMeasure.current = false;
            measureHeights();
            const container = containerRef.current;
            if (container) {
                const viewportHeight = viewportHeightRef.current || container.clientHeight;
                updateRange(container.scrollTop, viewportHeight, getOverscanPx(0, viewportHeight));
            }
        }, LAYOUT_IDLE_MS);
    }, [containerRef, getOverscanPx, measureHeights, updateRange]);

    useEffect(() => {
        if (!shouldVirtualize) return;
        const firstBlock = allBlocks[0]?.blockId ?? '';
        const lastBlock = allBlocks[allBlocks.length - 1]?.blockId ?? '';
        const signature = `${allBlocks.length}:${firstBlock}:${lastBlock}`;
        if (signature === lastBlocksSignatureRef.current) return;
        lastBlocksSignatureRef.current = signature;
        blockHeights.current.clear();
        prevPrefixHeightsRef.current = [];
        setHeightVersion(0);
    }, [allBlocks, shouldVirtualize]);

    useEffect(() => {
        if (!shouldVirtualize) {
            const fullRange = { start: 0, end: allBlocks.length };
            visibleRangeRef.current = fullRange;
            setVisibleRange(fullRange);
            return;
        }
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = (frameId?: number) => {
            const scrollTop = container.scrollTop;
            const viewportHeight = viewportHeightRef.current || container.clientHeight;
            const now = performance.now();
            const lastTs = lastScrollTs.current ?? now;
            const dt = Math.max(1, now - lastTs);
            const distance = Math.abs(scrollTop - lastScrollTop.current);
            const velocity = distance / dt;
            const overscanPx = getOverscanPx(velocity, viewportHeight);
            const overscanTier = velocity > FAST_SCROLL_PX_PER_MS ? 'fast' : 'base';

            if (perfEnabled && overscanTier !== lastOverscanTier.current) {
                lastOverscanTier.current = overscanTier;
                console.debug('[DocViewer] overscan tier', {
                    tier: overscanTier,
                    velocityPxPerMs: Number(velocity.toFixed(2)),
                });
            }

            lastScrollTop.current = scrollTop;
            lastScrollTs.current = now;
            if (!isScrolling.current) {
                isScrolling.current = true;
                setDocViewerScrolling(true);
            }

            if (idleTimeoutId.current) {
                clearTimeout(idleTimeoutId.current);
            }
            idleTimeoutId.current = window.setTimeout(() => {
                isScrolling.current = false;
                setDocViewerScrolling(false);
                if (pendingMeasure.current) {
                    pendingMeasure.current = false;
                    measureHeights();
                }
                const currentScrollTop = container.scrollTop;
                const currentViewportHeight = viewportHeightRef.current || container.clientHeight;
                updateRange(currentScrollTop, currentViewportHeight, getOverscanPx(0, currentViewportHeight));
                if (perfEnabled) {
                    flushDocViewerPerf('scroll-idle');
                }
            }, SCROLL_IDLE_MS);

            updateRange(scrollTop, viewportHeight, overscanPx, frameId);
        };

        viewportHeightRef.current = container.clientHeight;

        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) return;
            const nextHeight = Math.round(entry.contentRect.height);
            if (!nextHeight || nextHeight === viewportHeightRef.current) return;
            viewportHeightRef.current = nextHeight;
            if (!shouldVirtualize) return;
            isResizing.current = true;
            if (resizeIdleTimeoutId.current) {
                clearTimeout(resizeIdleTimeoutId.current);
            }
            resizeIdleTimeoutId.current = window.setTimeout(() => {
                isResizing.current = false;
                if (pendingMeasure.current || isScrolling.current) {
                    pendingMeasure.current = true;
                    return;
                }
                measureHeights();
                updateRange(container.scrollTop, nextHeight, getOverscanPx(0, nextHeight));
            }, RESIZE_IDLE_MS);

            if (resizeRafIdRef.current) return;
            resizeRafIdRef.current = requestAnimationFrame(() => {
                resizeRafIdRef.current = null;
                updateRange(container.scrollTop, nextHeight, getOverscanPx(0, nextHeight));
            });
        });

        resizeObserver.observe(container);

        // Initial calculation
        handleScroll();

        // Throttled scroll listener
        let rafId: number | null = null;
        const throttledScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                frameIdRef.current += 1;
                handleScroll(frameIdRef.current);
            });
        };

        container.addEventListener('scroll', throttledScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', throttledScroll);
            if (rafId) cancelAnimationFrame(rafId);
            if (idleTimeoutId.current) {
                clearTimeout(idleTimeoutId.current);
            }
            if (resizeIdleTimeoutId.current) {
                clearTimeout(resizeIdleTimeoutId.current);
            }
            if (layoutIdleTimeoutId.current) {
                clearTimeout(layoutIdleTimeoutId.current);
            }
            if (resizeRafIdRef.current) {
                cancelAnimationFrame(resizeRafIdRef.current);
            }
            resizeObserver.disconnect();
            if (isScrolling.current) {
                setDocViewerScrolling(false);
                isScrolling.current = false;
            }
        };
    }, [allBlocks, containerRef, getOverscanPx, measureHeights, perfEnabled, shouldVirtualize, updateRange]);

    useEffect(() => {
        if (!shouldVirtualize) return;
        if (layoutVersion === undefined) return;
        if (layoutVersion === lastLayoutVersionRef.current) return;
        lastLayoutVersionRef.current = layoutVersion;
        pendingMeasure.current = true;
        scheduleIdleRemeasure(layoutIdleTimeoutId);
    }, [layoutVersion, scheduleIdleRemeasure, shouldVirtualize]);

    // Measure block heights when they render
    useLayoutEffect(() => {
        if (!shouldVirtualize) return;
        if (isScrolling.current || isResizing.current) {
            pendingMeasure.current = true;
            return;
        }
        measureHeights();
    }, [measureHeights, shouldVirtualize, visibleRange]);

    useLayoutEffect(() => {
        if (!shouldVirtualize) {
            prevPrefixHeightsRef.current = prefixHeights;
            return;
        }
        if (isScrolling.current) {
            prevPrefixHeightsRef.current = prefixHeights;
            return;
        }
        const container = containerRef.current;
        if (!container) {
            prevPrefixHeightsRef.current = prefixHeights;
            return;
        }
        const previousPrefix = prevPrefixHeightsRef.current;
        const previousStartOffset = previousPrefix[visibleRange.start] ?? 0;
        const nextStartOffset = prefixHeights[visibleRange.start] ?? 0;
        const delta = nextStartOffset - previousStartOffset;
        if (delta !== 0) {
            container.scrollTop += delta;
        }
        prevPrefixHeightsRef.current = prefixHeights;
    }, [containerRef, prefixHeights, shouldVirtualize, visibleRange.start]);

    useEffect(() => {
        if (!perfEnabled) return;
        const renderedCount = visibleRange.end - visibleRange.start;
        console.debug('[DocViewer] visible range update', {
            count: rangeUpdateCount.current,
            range: visibleRange,
            renderedCount,
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
