import type { GraphViewport } from './graphViewport';

type ViewportSize = { w: number; h: number };
type ViewportOrigin = { x0: number; y0: number; hasBounds: boolean };
type BoxedCounterKey = 'boxedClampCalls' | 'boxedPointerNormCalls' | 'boxedTooltipClampCalls';

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const boxedCounters: Record<BoxedCounterKey, number> = {
    boxedClampCalls: 0,
    boxedPointerNormCalls: 0,
    boxedTooltipClampCalls: 0,
};
const warnedMissingBoundsKeys = new Set<string>();

function bumpBoxedCounter(key: BoxedCounterKey): void {
    if (!IS_DEV) return;
    boxedCounters[key] += 1;
}

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
    if (!isBoxedViewport(viewport)) {
        return { x0: 0, y0: 0, hasBounds: false };
    }
    if (!viewport.boundsRect) {
        if (IS_DEV && !warnedMissingBoundsKeys.has(viewport.mode)) {
            warnedMissingBoundsKeys.add(viewport.mode);
            console.warn('[ViewportMath] boxed viewport missing boundsRect; using origin 0,0 fallback');
        }
        return { x0: 0, y0: 0, hasBounds: false };
    }
    return {
        x0: viewport.boundsRect.left,
        y0: viewport.boundsRect.top,
        hasBounds: true,
    };
}

export function toViewportLocalPoint(clientX: number, clientY: number, viewport: GraphViewport): { x: number; y: number } {
    if (isBoxedViewport(viewport)) {
        bumpBoxedCounter('boxedPointerNormCalls');
    }
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
    bumpBoxedCounter('boxedClampCalls');
    const min = margin;
    const max = Math.max(margin, viewportSize - contentSize - margin);
    return Math.max(min, Math.min(value, max));
}

export function recordBoxedTooltipClampCall(): void {
    bumpBoxedCounter('boxedTooltipClampCalls');
}

export function recordBoxedClampCall(): void {
    bumpBoxedCounter('boxedClampCalls');
}

export function getBoxedViewportDebugCounters(): Record<BoxedCounterKey, number> {
    return { ...boxedCounters };
}
