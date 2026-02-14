import React from 'react';
import type { BuiltTimeline, TimelineEvent } from '../screens/welcome2Timeline';
import { avg, clamp, nowMs, quantiles } from '../utils/typingMetrics';

export type TypedTimelinePhase = 'typing' | 'hold' | 'done';

export type TypedTimelineState = {
    visibleCharCount: number;
    visibleText: string;
    phase: TypedTimelinePhase;
    isTypingDone: boolean;
    isTextFullyRevealed: boolean;
    isDone: boolean;
    elapsedMs: number;
    lastCharTimeMs: number;
    timeToDoneMs: number;
    seekToMs: (ms: number) => void;
    setClockPaused: (paused: boolean) => void;
};

const DEBUG_WELCOME2_TYPE = false;
const DEBUG_WELCOME2_FLICKER = false;
const DEBUG_LOG_INTERVAL_MS = 500;
const ELAPSED_PUBLISH_INTERVAL_MS = 100;
const PRE_CHAR_EPS_MS = 1;

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
    // "hold" is an intentional post-typing hold window; it is not timeline completion.
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
    const startTimeMsRef = React.useRef(0);
    const offsetMsRef = React.useRef(0);
    const elapsedMsRef = React.useRef(0);
    const seekEpochRef = React.useRef(0);
    const isClockPausedRef = React.useRef(false);
    const pauseStartedNowMsRef = React.useRef<number | null>(null);
    const lastCharTimeMs = React.useMemo(() => getLastCharTimeMs(built.events), [built.events]);

    const seekToMs = React.useCallback((ms: number) => {
        const targetElapsedMs = clamp(Math.round(ms), -PRE_CHAR_EPS_MS, built.totalMs);
        const currentElapsedMs = elapsedMsRef.current;
        offsetMsRef.current += targetElapsedMs - currentElapsedMs;
        elapsedMsRef.current = targetElapsedMs;
        seekEpochRef.current += 1;

        const visibleCharCount = getVisibleCharCountAtElapsed(built.events, targetElapsedMs);
        const phase = getPhase(targetElapsedMs, lastCharTimeMs, built.totalMs);
        setState((prev) => {
            if (
                prev.visibleCharCount === visibleCharCount &&
                prev.phase === phase &&
                prev.elapsedMs === targetElapsedMs
            ) {
                return prev;
            }
            return {
                visibleCharCount,
                phase,
                elapsedMs: targetElapsedMs,
            };
        });
    }, [built.events, built.totalMs, lastCharTimeMs]);

    const setClockPaused = React.useCallback((paused: boolean) => {
        const now = nowMs();
        if (paused) {
            if (isClockPausedRef.current) return;
            isClockPausedRef.current = true;
            pauseStartedNowMsRef.current = now;
            return;
        }

        if (!isClockPausedRef.current) return;
        const pauseStartedNowMs = pauseStartedNowMsRef.current ?? now;
        const pausedDurationMs = Math.max(0, now - pauseStartedNowMs);
        startTimeMsRef.current += pausedDurationMs;
        pauseStartedNowMsRef.current = null;
        isClockPausedRef.current = false;
    }, []);

    React.useEffect(() => {
        let rafId = 0;
        let isActive = true;
        startTimeMsRef.current = nowMs();
        offsetMsRef.current = 0;
        elapsedMsRef.current = 0;
        seekEpochRef.current = 0;
        isClockPausedRef.current = false;
        pauseStartedNowMsRef.current = null;
        let lastDebugBucket = -1;
        let lastNowMs: number | null = null;
        let guardViolationLogged = false;
        let summaryLogged = false;
        let prevVisibleCharCount = getInitialState(built).visibleCharCount;
        let lastSeenSeekEpoch = seekEpochRef.current;
        let holdAtMs: number | null = null;
        let doneAtMs: number | null = null;
        let pendingNewlineIndex: number | null = null;

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

            const elapsedMs = isClockPausedRef.current
                ? elapsedMsRef.current
                : clamp(
                    Math.round((nowMs - startTimeMsRef.current) + offsetMsRef.current),
                    0,
                    built.totalMs
                );
            elapsedMsRef.current = elapsedMs;
            const visibleCharCount = getVisibleCharCountAtElapsed(built.events, elapsedMs);
            const phase = getPhase(elapsedMs, lastCharTimeMs, built.totalMs);
            const didSeekSinceLastFrame = seekEpochRef.current !== lastSeenSeekEpoch;
            if (didSeekSinceLastFrame) {
                lastSeenSeekEpoch = seekEpochRef.current;
            }

            const maxVisible = built.renderText.length;
            if (
                (visibleCharCount < prevVisibleCharCount && !didSeekSinceLastFrame) ||
                visibleCharCount > maxVisible
            ) {
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
                    const event = built.events[eventIndex];
                    const expectedMs = event?.tMs ?? elapsedMs;
                    latenessMs.push(elapsedMs - expectedMs);
                    if (debugTypeMetrics && DEBUG_WELCOME2_FLICKER && event?.char === '\n') {
                        console.log(
                            '[Welcome2TypeFlicker] newline charIndex=%d elapsedMs=%d expectedMs=%d',
                            event.charIndex,
                            elapsedMs,
                            expectedMs
                        );
                        pendingNewlineIndex = eventIndex;
                        continue;
                    }
                    if (
                        debugTypeMetrics &&
                        DEBUG_WELCOME2_FLICKER &&
                        pendingNewlineIndex !== null &&
                        eventIndex > pendingNewlineIndex
                    ) {
                        console.log(
                            '[Welcome2TypeFlicker] next-after-newline charIndex=%d char=%s elapsedMs=%d expectedMs=%d',
                            event?.charIndex ?? eventIndex,
                            JSON.stringify(event?.char ?? ''),
                            elapsedMs,
                            expectedMs
                        );
                        pendingNewlineIndex = null;
                    }
                }
            }

            if (phase === 'hold' && holdAtMs === null) {
                holdAtMs = elapsedMs;
            }
            if (phase === 'done' && doneAtMs === null) {
                doneAtMs = elapsedMs;
            }
            if (phase === 'typing' && didSeekSinceLastFrame) {
                holdAtMs = null;
                doneAtMs = null;
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
    const elapsedMsClamped = Math.max(0, state.elapsedMs);
    const isTextFullyRevealed =
        state.visibleCharCount >= built.events.length || elapsedMsClamped >= lastCharTimeMs;
    const isDone = elapsedMsClamped >= built.totalMs;
    const timeToDoneMs = Math.max(0, built.totalMs - elapsedMsClamped);

    return {
        visibleCharCount: state.visibleCharCount,
        visibleText,
        phase: state.phase,
        isTypingDone: state.phase !== 'typing',
        isTextFullyRevealed,
        isDone,
        elapsedMs: elapsedMsClamped,
        lastCharTimeMs,
        timeToDoneMs,
        seekToMs,
        setClockPaused,
    };
}
