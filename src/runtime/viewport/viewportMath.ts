import type { GraphViewport } from './graphViewport';

type ViewportSize = { w: number; h: number };
type ViewportOrigin = { x0: number; y0: number; hasBounds: boolean };

function clampMinOne(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
}

export function isBoxedViewport(viewport: GraphViewport): boolean {
    return viewport.mode === 'boxed';
}

export function getViewportSize(viewport: GraphViewport, fallbackW: number, fallbackH: number): ViewportSize {
    if (!isBoxedViewport(viewport)) {
        return { w: clampMinOne(fallbackW), h: clampMinOne(fallbackH) };
    }
    return {
        w: clampMinOne(viewport.width || fallbackW),
        h: clampMinOne(viewport.height || fallbackH),
    };
}

export function getViewportOrigin(viewport: GraphViewport): ViewportOrigin {
    if (!isBoxedViewport(viewport) || !viewport.boundsRect) {
        return { x0: 0, y0: 0, hasBounds: false };
    }
    return {
        x0: viewport.boundsRect.left,
        y0: viewport.boundsRect.top,
        hasBounds: true,
    };
}

export function toViewportLocalPoint(clientX: number, clientY: number, viewport: GraphViewport): { x: number; y: number } {
    const origin = getViewportOrigin(viewport);
    if (!origin.hasBounds) {
        return { x: clientX, y: clientY };
    }
    return {
        x: clientX - origin.x0,
        y: clientY - origin.y0,
    };
}

export function clampToViewport(value: number, contentSize: number, viewportSize: number, margin: number): number {
    const min = margin;
    const max = Math.max(margin, viewportSize - contentSize - margin);
    return Math.max(min, Math.min(value, max));
}
