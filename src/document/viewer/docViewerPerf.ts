export interface DocViewerPerfCounters {
    contentRenders: number;
    blockRenders: number;
    contentRendersDuringScroll: number;
    blockRendersDuringScroll: number;
    storeUpdatesDuringScroll: number;
    rangeUpdates: number;
    rangeUpdatesDuringScroll: number;
    rangeUpdatesThisFrameMax: number;
    lastFlushMs: number;
}

type DocViewerPerfWindow = typeof window & {
    __DOC_VIEWER_PROFILE__?: boolean;
    __DOC_VIEWER_SCROLLING__?: boolean;
    __DOC_VIEWER_PERF__?: DocViewerPerfCounters;
};

const fallbackCounters: DocViewerPerfCounters = {
    contentRenders: 0,
    blockRenders: 0,
    contentRendersDuringScroll: 0,
    blockRendersDuringScroll: 0,
    storeUpdatesDuringScroll: 0,
    rangeUpdates: 0,
    rangeUpdatesDuringScroll: 0,
    rangeUpdatesThisFrameMax: 0,
    lastFlushMs: 0,
};

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

export function isDocViewerPerfEnabled(): boolean {
    if (!isBrowser()) return false;
    return Boolean((window as DocViewerPerfWindow).__DOC_VIEWER_PROFILE__);
}

export function setDocViewerScrolling(isScrolling: boolean): void {
    if (!isBrowser()) return;
    (window as DocViewerPerfWindow).__DOC_VIEWER_SCROLLING__ = isScrolling;
}

export function isDocViewerScrolling(): boolean {
    if (!isBrowser()) return false;
    return Boolean((window as DocViewerPerfWindow).__DOC_VIEWER_SCROLLING__);
}

function getPerfCounters(): DocViewerPerfCounters {
    if (!isBrowser()) return fallbackCounters;
    const perfWindow = window as DocViewerPerfWindow;
    if (!perfWindow.__DOC_VIEWER_PERF__) {
        perfWindow.__DOC_VIEWER_PERF__ = { ...fallbackCounters };
    }
    return perfWindow.__DOC_VIEWER_PERF__!;
}

export function recordDocViewerRender(kind: 'content' | 'block'): void {
    if (!isDocViewerPerfEnabled()) return;
    const counters = getPerfCounters();
    const scrolling = isDocViewerScrolling();
    if (kind === 'content') {
        counters.contentRenders += 1;
        if (scrolling) counters.contentRendersDuringScroll += 1;
        return;
    }
    counters.blockRenders += 1;
    if (scrolling) counters.blockRendersDuringScroll += 1;
}

export function recordDocViewerRangeUpdate(updatesThisFrame: number): void {
    if (!isDocViewerPerfEnabled()) return;
    const counters = getPerfCounters();
    counters.rangeUpdates += 1;
    if (isDocViewerScrolling()) {
        counters.rangeUpdatesDuringScroll += 1;
    }
    if (updatesThisFrame > counters.rangeUpdatesThisFrameMax) {
        counters.rangeUpdatesThisFrameMax = updatesThisFrame;
    }
}

export function recordDocViewerStoreUpdate(): void {
    if (!isDocViewerPerfEnabled()) return;
    if (!isDocViewerScrolling()) return;
    const counters = getPerfCounters();
    counters.storeUpdatesDuringScroll += 1;
}

export function flushDocViewerPerf(reason: string): void {
    if (!isDocViewerPerfEnabled()) return;
    const counters = getPerfCounters();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = counters.lastFlushMs ? Math.round(now - counters.lastFlushMs) : null;
    counters.lastFlushMs = now;
    console.debug('[DocViewer] perf summary', {
        reason,
        elapsedMs: elapsed,
        contentRenders: counters.contentRenders,
        blockRenders: counters.blockRenders,
        contentRendersDuringScroll: counters.contentRendersDuringScroll,
        blockRendersDuringScroll: counters.blockRendersDuringScroll,
        storeUpdatesDuringScroll: counters.storeUpdatesDuringScroll,
        rangeUpdates: counters.rangeUpdates,
        rangeUpdatesDuringScroll: counters.rangeUpdatesDuringScroll,
        rangeUpdatesThisFrameMax: counters.rangeUpdatesThisFrameMax,
    });

    counters.contentRenders = 0;
    counters.blockRenders = 0;
    counters.contentRendersDuringScroll = 0;
    counters.blockRendersDuringScroll = 0;
    counters.storeUpdatesDuringScroll = 0;
    counters.rangeUpdates = 0;
    counters.rangeUpdatesDuringScroll = 0;
    counters.rangeUpdatesThisFrameMax = 0;
}
