import React from 'react';
import type { BuiltTimeline, TimelineEvent } from '../screens/welcome2Timeline';
import { avg, clamp, nowMs, quantiles } from '../utils/typingMetrics';

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
const ELAPSED_PUBLISH_INTERVAL_MS = 100;

type InternalState = {
    visibleCharCount: number;
    elapsedMs: number;
    phase: TypedTimelinePhase;
};

type UseTypedTimelineOptions = {
    debugTypeMetrics?: boolean;
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

export function useTypedTimeline(
    built: BuiltTimeline,
    options: UseTypedTimelineOptions = {}
): TypedTimelineState {
    const [state, setState] = React.useState<InternalState>(() => getInitialState(built));
    const debugTypeMetrics = options.debugTypeMetrics ?? DEBUG_WELCOME2_TYPE;

    React.useEffect(() => {
        let rafId = 0;
        let isActive = true;
        const startTimeMs = nowMs();
        const lastCharTimeMs = getLastCharTimeMs(built.events);
        let lastDebugBucket = -1;
        let lastNowMs: number | null = null;
        let guardViolationLogged = false;
        let summaryLogged = false;
        let prevVisibleCharCount = getInitialState(built).visibleCharCount;
        let holdAtMs: number | null = null;
        let doneAtMs: number | null = null;

        const frameDtMs: number[] = [];
        const latenessMs: number[] = [];

        const emitSummary = (reason: 'done' | 'cleanup' | 'guard-stop') => {
            if (!debugTypeMetrics) return;
            if (summaryLogged) return;
            summaryLogged = true;

            const dtStats = quantiles(frameDtMs);
            const latenessStats = quantiles(latenessMs);
            console.log(
                '[Welcome2Type] summary reason=%s chars=%d totalMs=%d',
                reason,
                built.renderText.length,
                built.totalMs
            );
            console.log(
                '[Welcome2Type] frameDtMs avg=%.2f p95=%.2f max=%.2f',
                avg(frameDtMs),
                dtStats.p95,
                dtStats.max
            );
            console.log(
                '[Welcome2Type] charLatenessMs count=%d p50=%.2f p95=%.2f max=%.2f',
                latenessMs.length,
                latenessStats.p50,
                latenessStats.p95,
                latenessStats.max
            );
            console.log(
                '[Welcome2Type] phaseTimes holdAtMs=%s doneAtMs=%s',
                holdAtMs === null ? 'n/a' : String(holdAtMs),
                doneAtMs === null ? 'n/a' : String(doneAtMs)
            );
        };

        setState(getInitialState(built));

        const onFrame = (nowMs: number) => {
            if (!isActive) return;

            if (lastNowMs !== null) {
                const dt = clamp(nowMs - lastNowMs, 0, 1000);
                frameDtMs.push(dt);
            }
            lastNowMs = nowMs;

            const elapsedMs = Math.max(0, Math.round(nowMs - startTimeMs));
            const visibleCharCount = getVisibleCharCountAtElapsed(built.events, elapsedMs);
            const phase = getPhase(elapsedMs, lastCharTimeMs, built.totalMs);

            const maxVisible = built.renderText.length;
            if (visibleCharCount < prevVisibleCharCount || visibleCharCount > maxVisible) {
                if (!guardViolationLogged) {
                    guardViolationLogged = true;
                    console.log(
                        '[Welcome2Type] guard violation visibleCharCount=%d prev=%d max=%d',
                        visibleCharCount,
                        prevVisibleCharCount,
                        maxVisible
                    );
                }
                emitSummary('guard-stop');
                isActive = false;
                cancelAnimationFrame(rafId);
                return;
            }

            if (visibleCharCount > prevVisibleCharCount) {
                for (let count = prevVisibleCharCount + 1; count <= visibleCharCount; count += 1) {
                    const eventIndex = count - 1;
                    const expectedMs = built.events[eventIndex]?.tMs ?? elapsedMs;
                    latenessMs.push(elapsedMs - expectedMs);
                }
            }

            if (phase === 'hold' && holdAtMs === null) {
                holdAtMs = elapsedMs;
            }
            if (phase === 'done' && doneAtMs === null) {
                doneAtMs = elapsedMs;
            }

            prevVisibleCharCount = visibleCharCount;
            setState((prev) => {
                const visibleChanged = prev.visibleCharCount !== visibleCharCount;
                const phaseChanged = prev.phase !== phase;
                const elapsedDue = elapsedMs - prev.elapsedMs >= ELAPSED_PUBLISH_INTERVAL_MS;
                if (
                    !visibleChanged &&
                    !phaseChanged &&
                    !elapsedDue
                ) {
                    return prev;
                }
                return { elapsedMs, visibleCharCount, phase };
            });

            if (debugTypeMetrics) {
                const bucket = Math.floor(elapsedMs / DEBUG_LOG_INTERVAL_MS);
                if (bucket !== lastDebugBucket) {
                    lastDebugBucket = bucket;
                    console.log('[Welcome2Type] elapsedMs=%d visibleCharCount=%d phase=%s', elapsedMs, visibleCharCount, phase);
                }
            }

            if (phase === 'done') {
                emitSummary('done');
            } else {
                rafId = requestAnimationFrame(onFrame);
            }
        };

        rafId = requestAnimationFrame(onFrame);

        return () => {
            isActive = false;
            cancelAnimationFrame(rafId);
            emitSummary('cleanup');
        };
    }, [built, debugTypeMetrics]);

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
