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

function toViewportRect(rect: DOMRectReadOnly): GraphViewportRect {
    return {
        left: rect.left,
        top: rect.top,
        width: clampViewportDim(rect.width),
        height: clampViewportDim(rect.height),
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

function makeViewport(mode: GraphViewportMode, source: GraphViewportSource, rect: DOMRectReadOnly): GraphViewport {
    const boundsRect = toViewportRect(rect);
    return {
        mode,
        source,
        width: boundsRect.width,
        height: boundsRect.height,
        dpr: readDpr(),
        boundsRect,
    };
}

export function useResizeObserverViewport<T extends HTMLElement>(
    elementRef: React.RefObject<T>,
    options: UseResizeObserverViewportOptions
): GraphViewport {
    const fallbackViewport = options.fallbackViewport ?? defaultGraphViewport();
    const [viewport, setViewport] = React.useState<GraphViewport>(fallbackViewport);
    const viewportRef = React.useRef<GraphViewport>(fallbackViewport);
    const latestRectRef = React.useRef<DOMRectReadOnly | null>(null);
    const pendingRafIdRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        const target = elementRef.current;
        if (!target) return;
        if (typeof window === 'undefined') return;
        if (typeof ResizeObserver === 'undefined') return;

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
            const rect = latestRectRef.current;
            if (!rect) return;
            const nextViewport = makeViewport(options.mode, options.source, rect);
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
            const entry = entries[0];
            if (!entry) return;
            latestRectRef.current = entry.contentRect;
            scheduleViewportUpdate();
        });

        observer.observe(target);
        latestRectRef.current = target.getBoundingClientRect();
        scheduleViewportUpdate();

        return () => {
            disposed = true;
            cancelScheduledFrame();
            observer.disconnect();
            releaseObserverTrack();
        };
    }, [elementRef, options.mode, options.source]);

    return viewport;
}
