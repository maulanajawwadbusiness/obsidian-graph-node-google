import React from 'react';
import type { BuiltTimeline, TimelineEvent } from '../screens/welcome2Timeline';

export type TypedTimelinePhase = 'typing' | 'hold' | 'done';

export type TypedTimelineState = {
    visibleCharCount: number;
    visibleText: string;
    phase: TypedTimelinePhase;
    isTypingDone: boolean;
    isDone: boolean;
    elapsedMs: number;
};

const DEBUG_WELCOME2_TYPE = false;
const DEBUG_LOG_INTERVAL_MS = 500;

type InternalState = {
    visibleCharCount: number;
    elapsedMs: number;
    phase: TypedTimelinePhase;
};

function getLastCharTimeMs(events: TimelineEvent[]): number {
    if (events.length === 0) return 0;
    return events[events.length - 1].tMs;
}

function getPhase(elapsedMs: number, lastCharTimeMs: number, totalMs: number): TypedTimelinePhase {
    if (elapsedMs >= totalMs) return 'done';
    if (elapsedMs >= lastCharTimeMs) return 'hold';
    return 'typing';
}

function getInitialState(built: BuiltTimeline): InternalState {
    const elapsedMs = 0;
    const visibleCharCount = getVisibleCharCountAtElapsed(built.events, elapsedMs);
    const phase = getPhase(elapsedMs, getLastCharTimeMs(built.events), built.totalMs);
    return { visibleCharCount, elapsedMs, phase };
}

export function getVisibleCharCountAtElapsed(events: TimelineEvent[], elapsedMs: number): number {
    if (events.length === 0) return 0;
    if (elapsedMs < events[0].tMs) return 0;

    let low = 0;
    let high = events.length - 1;
    let lastVisibleIndex = -1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (events[mid].tMs <= elapsedMs) {
            lastVisibleIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return lastVisibleIndex + 1;
}

export function useTypedTimeline(built: BuiltTimeline): TypedTimelineState {
    const [state, setState] = React.useState<InternalState>(() => getInitialState(built));

    React.useEffect(() => {
        let rafId = 0;
        let isActive = true;
        const startTimeMs = performance.now();
        const lastCharTimeMs = getLastCharTimeMs(built.events);
        let lastDebugBucket = -1;

        setState(getInitialState(built));

        const onFrame = (nowMs: number) => {
            if (!isActive) return;

            const elapsedMs = Math.max(0, Math.round(nowMs - startTimeMs));
            const visibleCharCount = getVisibleCharCountAtElapsed(built.events, elapsedMs);
            const phase = getPhase(elapsedMs, lastCharTimeMs, built.totalMs);

            setState((prev) => {
                if (
                    prev.elapsedMs === elapsedMs &&
                    prev.visibleCharCount === visibleCharCount &&
                    prev.phase === phase
                ) {
                    return prev;
                }
                return { elapsedMs, visibleCharCount, phase };
            });

            if (DEBUG_WELCOME2_TYPE) {
                const bucket = Math.floor(elapsedMs / DEBUG_LOG_INTERVAL_MS);
                if (bucket !== lastDebugBucket) {
                    lastDebugBucket = bucket;
                    console.log('[Welcome2Type] elapsedMs=%d visibleCharCount=%d phase=%s', elapsedMs, visibleCharCount, phase);
                }
            }

            if (phase !== 'done') {
                rafId = requestAnimationFrame(onFrame);
            }
        };

        rafId = requestAnimationFrame(onFrame);

        return () => {
            isActive = false;
            cancelAnimationFrame(rafId);
        };
    }, [built]);

    const visibleText = React.useMemo(
        () => built.renderText.slice(0, state.visibleCharCount),
        [built.renderText, state.visibleCharCount]
    );

    return {
        visibleCharCount: state.visibleCharCount,
        visibleText,
        phase: state.phase,
        isTypingDone: state.phase !== 'typing',
        isDone: state.phase === 'done',
        elapsedMs: state.elapsedMs,
    };
}
