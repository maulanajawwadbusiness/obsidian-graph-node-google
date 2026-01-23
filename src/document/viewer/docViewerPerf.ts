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
    __DOC_VIEWER_PERF_MARKS__?: boolean;
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

function isDocViewerPerfMarksEnabled(): boolean {
    if (!isBrowser()) return false;
    const perfWindow = window as DocViewerPerfWindow;
    return Boolean(perfWindow.__DOC_VIEWER_PERF_MARKS__ ?? perfWindow.__DOC_VIEWER_PROFILE__);
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

export function markDocViewerPerf(mark: string): void {
    if (!isDocViewerPerfMarksEnabled()) return;
    if (typeof performance === 'undefined') return;
    performance.mark(mark);
}

export function reportDocViewerPerf(): void {
    if (!isDocViewerPerfMarksEnabled()) return;
    if (typeof performance === 'undefined') return;
    const marks = [
        'doc_open_start',
        'file_read_done',
        'text_extract_done',
        'normalize_done',
        'block_build_first_chunk_done',
        'first_paint_committed',
        'hydrate_done',
        'font_ready',
    ];

    const times: Record<string, number | null> = {};
    for (const mark of marks) {
        const entry = performance.getEntriesByName(mark).slice(-1)[0];
        times[mark] = entry ? entry.startTime : null;
    }

    const base = times.doc_open_start ?? null;
    const delta = (mark: string) => (base !== null && times[mark] !== null)
        ? Math.round((times[mark]! - base) * 10) / 10
        : null;

    console.debug('[DocViewer] open perf', {
        docOpenToFileReadMs: delta('file_read_done'),
        docOpenToTextExtractMs: delta('text_extract_done'),
        docOpenToNormalizeMs: delta('normalize_done'),
        docOpenToFirstChunkMs: delta('block_build_first_chunk_done'),
        docOpenToFirstPaintMs: delta('first_paint_committed'),
        docOpenToHydrateMs: delta('hydrate_done'),
        docOpenToFontReadyMs: delta('font_ready'),
    });

    marks.forEach(mark => performance.clearMarks(mark));
}
