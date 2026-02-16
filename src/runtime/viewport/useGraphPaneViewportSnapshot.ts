import React from 'react';
import { GraphViewport, GraphViewportRect, defaultGraphViewport } from './graphViewport';

function clampMinOne(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, value);
}

function toRectSnapshot(rect: DOMRect): GraphViewportRect {
    return {
        left: rect.left,
        top: rect.top,
        width: clampMinOne(rect.width),
        height: clampMinOne(rect.height),
    };
}

function getDpr(): number {
    if (typeof window === 'undefined') return 1;
    const value = window.devicePixelRatio || 1;
    return Number.isFinite(value) ? Math.max(0.1, value) : 1;
}

export function useGraphPaneViewportSnapshot(
    paneRef: React.RefObject<HTMLElement>,
    fallbackViewport: GraphViewport = defaultGraphViewport()
): GraphViewport {
    const [viewport, setViewport] = React.useState<GraphViewport>(fallbackViewport);

    React.useLayoutEffect(() => {
        const paneEl = paneRef.current;
        if (!paneEl) return;
        let disposed = false;
        const rect = paneEl.getBoundingClientRect();
        const boundsRect = toRectSnapshot(rect);
        const nextViewport: GraphViewport = {
            mode: 'app',
            source: 'container',
            width: boundsRect.width,
            height: boundsRect.height,
            dpr: getDpr(),
            boundsRect,
        };
        if (!disposed) {
            setViewport(nextViewport);
        }
        return () => {
            disposed = true;
        };
    }, [paneRef]);

    return viewport;
}
