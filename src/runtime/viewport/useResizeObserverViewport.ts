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
let warnedBoxedStuckTinyViewport = false;
let warnedZeroOriginMismatch = false;
let warnedSettleCapReached = false;
let viewportPositionRefreshEvents = 0;
let viewportSettleFrames = 0;
type FlushReason = 'ro' | 'scroll' | 'vv' | 'interaction' | 'mount' | 'visibility';
const viewportFlushReason: Record<FlushReason, number> = {
    ro: 0,
    scroll: 0,
    vv: 0,
    interaction: 0,
    mount: 0,
    visibility: 0,
};
type ObserverSizeSnapshot = {
    width: number;
    height: number;
};
type OriginSnapshot = {
    left: number;
    top: number;
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
    const positionDirtyRef = React.useRef(false);
    const lastOriginRef = React.useRef<OriginSnapshot | null>(null);
    const settleFramesLeftRef = React.useRef(0);
    const settleFrameBudgetRef = React.useRef(0);

    React.useEffect(() => {
        if (!target) return;
        if (typeof window === 'undefined') return;
        if (typeof ResizeObserver === 'undefined') return;

        latestTargetRef.current = target;
        let disposed = false;
        const releaseObserverTrack = trackResource('graph-runtime.viewport.resize-observer');
        const releasePositionListenersTrack = trackResource('graph-runtime.viewport.position-listeners');
        const releaseInteractionListenersTrack = trackResource('graph-runtime.viewport.position-interaction-listeners');
        let releaseRafTrack: (() => void) | null = null;
        let releaseSettleRafTrack: (() => void) | null = null;
        const SETTLE_STABLE_FRAMES = 8;
        const SETTLE_MOUNT_STABLE_FRAMES = 20;
        const SETTLE_MAX_FRAMES = 60;
        const POINTER_MOVE_THROTTLE_MS = 120;
        const SCROLL_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };
        const PASSIVE_OPTIONS: AddEventListenerOptions = { passive: true };
        let lastPointerMoveMs = 0;
        const bumpFlushReason = (reason: FlushReason) => {
            if (!import.meta.env.DEV) return;
            viewportFlushReason[reason] += 1;
        };

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
        const stopSettleTracking = () => {
            settleFramesLeftRef.current = 0;
            settleFrameBudgetRef.current = 0;
            if (releaseSettleRafTrack) {
                releaseSettleRafTrack();
                releaseSettleRafTrack = null;
            }
        };
        const beginSettleTracking = (stableFrames: number = SETTLE_STABLE_FRAMES) => {
            if (!releaseSettleRafTrack) {
                releaseSettleRafTrack = trackResource('graph-runtime.viewport.position-settle-raf');
            }
            if (settleFrameBudgetRef.current <= 0) {
                settleFrameBudgetRef.current = SETTLE_MAX_FRAMES;
            }
            settleFramesLeftRef.current = Math.max(1, Math.floor(stableFrames));
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
            const currentOrigin: OriginSnapshot = { left: bcr.left, top: bcr.top };
            const previousOrigin = lastOriginRef.current;
            const originChanged =
                !previousOrigin ||
                Math.abs(previousOrigin.left - currentOrigin.left) > 0.1 ||
                Math.abs(previousOrigin.top - currentOrigin.top) > 0.1;
            lastOriginRef.current = currentOrigin;
            if (originChanged) {
                beginSettleTracking();
            }
            const nextViewport = makeViewport(options.mode, options.source, bcr, latestSizeRef.current);
            if (
                import.meta.env.DEV &&
                options.mode === 'boxed' &&
                nextViewport.boundsRect &&
                nextViewport.boundsRect.left === 0 &&
                nextViewport.boundsRect.top === 0 &&
                (Math.abs(bcr.left) > 0.5 || Math.abs(bcr.top) > 0.5) &&
                !warnedZeroOriginMismatch
            ) {
                warnedZeroOriginMismatch = true;
                console.warn(
                    '[ViewportResize] boxed origin mismatch: boundsRect=(%d,%d) bcr=(%d,%d)',
                    nextViewport.boundsRect.left,
                    nextViewport.boundsRect.top,
                    bcr.left,
                    bcr.top
                );
            }
            const viewportChanged = !sameViewport(viewportRef.current, nextViewport);
            if (viewportChanged) {
                viewportRef.current = nextViewport;
                setViewport(nextViewport);
            }
            positionDirtyRef.current = false;

            if (settleFramesLeftRef.current > 0 && settleFrameBudgetRef.current > 0) {
                settleFrameBudgetRef.current -= 1;
                if (import.meta.env.DEV) {
                    viewportSettleFrames += 1;
                }
                if (!originChanged) {
                    settleFramesLeftRef.current -= 1;
                } else {
                    settleFramesLeftRef.current = SETTLE_STABLE_FRAMES;
                }
                if (settleFrameBudgetRef.current <= 0) {
                    if (import.meta.env.DEV && !warnedSettleCapReached) {
                        warnedSettleCapReached = true;
                        console.warn('[ViewportResize] settle frame cap reached; stopping settle loop');
                    }
                    stopSettleTracking();
                    return;
                }
                if (settleFramesLeftRef.current > 0) {
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                        stopSettleTracking();
                        return;
                    }
                    scheduleViewportUpdate('interaction');
                    return;
                }
                stopSettleTracking();
            }
        };

        const scheduleViewportUpdate = (reason: FlushReason) => {
            if (disposed) return;
            bumpFlushReason(reason);
            if (pendingRafIdRef.current !== null) return;
            releaseRafTrack = trackResource('graph-runtime.viewport.resize-raf');
            pendingRafIdRef.current = window.requestAnimationFrame(flushViewportUpdate);
        };
        const triggerPositionRefresh = (reason: FlushReason) => {
            if (disposed) return;
            if (import.meta.env.DEV) {
                viewportPositionRefreshEvents += 1;
            }
            positionDirtyRef.current = true;
            scheduleViewportUpdate(reason);
        };
        const triggerInteractionRefresh = () => {
            if (disposed) return;
            triggerPositionRefresh('interaction');
        };
        const handlePointerEnter = () => {
            if (disposed) return;
            beginSettleTracking();
            triggerInteractionRefresh();
        };
        const handlePointerMove = () => {
            if (disposed) return;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - lastPointerMoveMs < POINTER_MOVE_THROTTLE_MS) return;
            lastPointerMoveMs = now;
            triggerInteractionRefresh();
        };
        const handleWheel = () => {
            if (disposed) return;
            triggerInteractionRefresh();
        };
        const handleVisibilityChange = () => {
            if (disposed) return;
            if (typeof document === 'undefined') return;
            if (document.visibilityState === 'hidden') {
                stopSettleTracking();
                return;
            }
            triggerPositionRefresh('visibility');
        };
        const handleWindowScroll = () => {
            triggerPositionRefresh('scroll');
        };
        const handleWindowResize = () => {
            triggerPositionRefresh('scroll');
        };
        const handleVisualViewportChange = () => {
            triggerPositionRefresh('vv');
        };

        const observer = new ResizeObserver((entries) => {
            if (disposed) return;
            const entry = pickEntryForTarget(entries, elementRef.current ?? latestTargetRef.current);
            if (!entry) return;
            latestTargetRef.current = entry.target as HTMLElement;
            latestSizeRef.current = readObserverSize(entry);
            scheduleViewportUpdate('ro');
        });

        observer.observe(target);
        latestSizeRef.current = {
            width: target.getBoundingClientRect().width,
            height: target.getBoundingClientRect().height,
        };
        scheduleViewportUpdate('mount');
        beginSettleTracking(SETTLE_MOUNT_STABLE_FRAMES);
        window.addEventListener('scroll', handleWindowScroll, SCROLL_OPTIONS);
        window.addEventListener('resize', handleWindowResize, PASSIVE_OPTIONS);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        const vv = window.visualViewport ?? null;
        if (vv) {
            vv.addEventListener('scroll', handleVisualViewportChange, PASSIVE_OPTIONS);
            vv.addEventListener('resize', handleVisualViewportChange, PASSIVE_OPTIONS);
        }
        target.addEventListener('pointerenter', handlePointerEnter, PASSIVE_OPTIONS);
        target.addEventListener('pointermove', handlePointerMove, PASSIVE_OPTIONS);
        target.addEventListener('wheel', handleWheel, PASSIVE_OPTIONS);
        let boxedTinyTimer: number | null = null;
        if (import.meta.env.DEV && options.mode === 'boxed') {
            boxedTinyTimer = window.setTimeout(() => {
                if (disposed) return;
                if (warnedBoxedStuckTinyViewport) return;
                const snap = viewportRef.current;
                const tiny = snap.width <= 1 || snap.height <= 1;
                const missingBounds = !snap.boundsRect;
                if (!tiny && !missingBounds) return;
                warnedBoxedStuckTinyViewport = true;
                console.warn(
                    '[ViewportResize] boxed viewport still tiny/missing after 600ms w=%d h=%d hasBounds=%s source=%s',
                    snap.width,
                    snap.height,
                    snap.boundsRect ? 'yes' : 'no',
                    snap.source
                );
            }, 600);
        }

        return () => {
            disposed = true;
            if (boxedTinyTimer !== null) {
                window.clearTimeout(boxedTinyTimer);
            }
            window.removeEventListener('scroll', handleWindowScroll, SCROLL_OPTIONS);
            window.removeEventListener('resize', handleWindowResize, PASSIVE_OPTIONS);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
            if (vv) {
                vv.removeEventListener('scroll', handleVisualViewportChange, PASSIVE_OPTIONS);
                vv.removeEventListener('resize', handleVisualViewportChange, PASSIVE_OPTIONS);
            }
            target.removeEventListener('pointerenter', handlePointerEnter, PASSIVE_OPTIONS);
            target.removeEventListener('pointermove', handlePointerMove, PASSIVE_OPTIONS);
            target.removeEventListener('wheel', handleWheel, PASSIVE_OPTIONS);
            releasePositionListenersTrack();
            releaseInteractionListenersTrack();
            stopSettleTracking();
            cancelScheduledFrame();
            observer.disconnect();
            latestTargetRef.current = null;
            latestSizeRef.current = null;
            lastOriginRef.current = null;
            positionDirtyRef.current = false;
            releaseObserverTrack();
        };
    }, [elementRef, target, options.mode, options.source]);

    return viewport;
}
