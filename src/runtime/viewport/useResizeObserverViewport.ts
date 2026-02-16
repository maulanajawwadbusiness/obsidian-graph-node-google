import React from 'react';
import { trackResource } from '../resourceTracker';
import {
    defaultGraphViewport,
    type GraphViewport,
    type GraphViewportMode,
    type GraphViewportRect,
    type GraphViewportSource,
} from './graphViewport';

type UseResizeObserverViewportOptions = {
    mode: GraphViewportMode;
    source: GraphViewportSource;
    fallbackViewport?: GraphViewport;
};
let warnedPendingRafAfterCleanup = false;
type ObserverSizeSnapshot = {
    width: number;
    height: number;
};

function clampViewportDim(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
}

function readDpr(): number {
    if (typeof window === 'undefined') return 1;
    const value = window.devicePixelRatio || 1;
    if (!Number.isFinite(value)) return 1;
    return Math.max(0.1, value);
}

function toViewportRect(left: number, top: number, width: number, height: number): GraphViewportRect {
    return {
        left,
        top,
        width: clampViewportDim(width),
        height: clampViewportDim(height),
    };
}

function sameRect(a: GraphViewportRect | null, b: GraphViewportRect | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function sameViewport(a: GraphViewport, b: GraphViewport): boolean {
    return (
        a.mode === b.mode &&
        a.source === b.source &&
        a.width === b.width &&
        a.height === b.height &&
        a.dpr === b.dpr &&
        sameRect(a.boundsRect, b.boundsRect)
    );
}

function makeViewport(
    mode: GraphViewportMode,
    source: GraphViewportSource,
    bcr: DOMRectReadOnly,
    size: ObserverSizeSnapshot | null
): GraphViewport {
    const width = size?.width ?? bcr.width;
    const height = size?.height ?? bcr.height;
    const boundsRect = toViewportRect(bcr.left, bcr.top, width, height);
    return {
        mode,
        source,
        width: boundsRect.width,
        height: boundsRect.height,
        dpr: readDpr(),
        boundsRect,
    };
}

function readObserverSize(entry: ResizeObserverEntry): ObserverSizeSnapshot | null {
    const anyEntry = entry as ResizeObserverEntry & {
        contentBoxSize?: ResizeObserverSize | ResizeObserverSize[];
    };
    const box = anyEntry.contentBoxSize;
    const normalized = Array.isArray(box) ? box[0] : box;
    if (
        normalized &&
        Number.isFinite(normalized.inlineSize) &&
        Number.isFinite(normalized.blockSize)
    ) {
        return {
            width: normalized.inlineSize,
            height: normalized.blockSize,
        };
    }
    if (
        Number.isFinite(entry.contentRect.width) &&
        Number.isFinite(entry.contentRect.height)
    ) {
        return {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
        };
    }
    return null;
}

function pickEntryForTarget(
    entries: ResizeObserverEntry[],
    target: HTMLElement | null
): ResizeObserverEntry | null {
    if (entries.length === 0) return null;
    if (!target) return entries[0];
    for (let idx = 0; idx < entries.length; idx += 1) {
        if (entries[idx].target === target) return entries[idx];
    }
    return entries[0];
}

export function useResizeObserverViewport<T extends HTMLElement>(
    elementRef: React.RefObject<T>,
    options: UseResizeObserverViewportOptions
): GraphViewport {
    const target = elementRef.current;
    const fallbackViewport = options.fallbackViewport ?? defaultGraphViewport();
    const [viewport, setViewport] = React.useState<GraphViewport>(fallbackViewport);
    const viewportRef = React.useRef<GraphViewport>(fallbackViewport);
    const latestTargetRef = React.useRef<HTMLElement | null>(target ?? null);
    const latestSizeRef = React.useRef<ObserverSizeSnapshot | null>(null);
    const pendingRafIdRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (!target) return;
        if (typeof window === 'undefined') return;
        if (typeof ResizeObserver === 'undefined') return;

        latestTargetRef.current = target;
        let disposed = false;
        const releaseObserverTrack = trackResource('graph-runtime.viewport.resize-observer');
        let releaseRafTrack: (() => void) | null = null;

        const cancelScheduledFrame = () => {
            const rafId = pendingRafIdRef.current;
            if (rafId === null) return;
            window.cancelAnimationFrame(rafId);
            pendingRafIdRef.current = null;
            if (releaseRafTrack) {
                releaseRafTrack();
                releaseRafTrack = null;
            }
        };

        const flushViewportUpdate = () => {
            pendingRafIdRef.current = null;
            if (releaseRafTrack) {
                releaseRafTrack();
                releaseRafTrack = null;
            }
            if (disposed) return;
            const activeTarget = elementRef.current ?? latestTargetRef.current;
            if (!activeTarget) return;
            if (!activeTarget.isConnected) return;
            const bcr = activeTarget.getBoundingClientRect();
            const nextViewport = makeViewport(options.mode, options.source, bcr, latestSizeRef.current);
            if (sameViewport(viewportRef.current, nextViewport)) return;
            viewportRef.current = nextViewport;
            setViewport(nextViewport);
        };

        const scheduleViewportUpdate = () => {
            if (disposed) return;
            if (pendingRafIdRef.current !== null) return;
            releaseRafTrack = trackResource('graph-runtime.viewport.resize-raf');
            pendingRafIdRef.current = window.requestAnimationFrame(flushViewportUpdate);
        };

        const observer = new ResizeObserver((entries) => {
            if (disposed) return;
            const entry = pickEntryForTarget(entries, elementRef.current ?? latestTargetRef.current);
            if (!entry) return;
            latestTargetRef.current = entry.target as HTMLElement;
            latestSizeRef.current = readObserverSize(entry);
            scheduleViewportUpdate();
        });

        observer.observe(target);
        latestSizeRef.current = {
            width: target.getBoundingClientRect().width,
            height: target.getBoundingClientRect().height,
        };
        scheduleViewportUpdate();

        return () => {
            disposed = true;
            cancelScheduledFrame();
            if (import.meta.env.DEV && pendingRafIdRef.current !== null && !warnedPendingRafAfterCleanup) {
                warnedPendingRafAfterCleanup = true;
                console.warn('[ViewportResize] pending rAF remained after cleanup');
            }
            observer.disconnect();
            latestTargetRef.current = null;
            latestSizeRef.current = null;
            releaseObserverTrack();
        };
    }, [elementRef, target, options.mode, options.source]);

    return viewport;
}
