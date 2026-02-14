import React from 'react';
import { DEFAULT_CADENCE } from '../config/onboardingCadence';
import { SHOW_ONBOARDING_AUX_BUTTONS } from '../config/onboardingUiFlags';
import { TypingCursor, type TypingCursorMode } from '../components/TypingCursor';
import { useTypedTimeline } from '../hooks/useTypedTimeline';
import { MANIFESTO_TEXT } from './welcome2ManifestoText';
import { buildWelcome2SentenceSpans, sentenceIndexForCharCount } from './welcome2SentenceSpans';
import { buildWelcome2Timeline } from './welcome2Timeline';

type Welcome2Props = {
    onNext: () => void;
    onSkip: () => void;
    onBack: () => void;
};

const DEBUG_WELCOME2_CURSOR = false;
const DEBUG_WELCOME2_INPUT_GUARD = false;
const CURSOR_PAUSE_THRESHOLD_MS = 130;
const CURSOR_HOLD_FAST_WINDOW_MS = 680;
const SHOW_WELCOME2_FOCUS_RING = false;
const WELCOME2_AUTO_ADVANCE_DELAY_MS = 2000*4;
const DOUBLE_CLICK_MS = 260;
const CHAIN_WINDOW_MS = 900;
const BACKSTEP_LAND_RATIO = 0.8;
const BACKSTEP_ELLIPSIS_START_DOTS = 3;
const BACKSTEP_ELLIPSIS_CHARS_PER_DOT_STEP = 2;
const BLOCKED_SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp']);
const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a[href], [role=\"button\"], [contenteditable=\"true\"]';
const DEBUG_WELCOME2_TYPE = false;

export const Welcome2: React.FC<Welcome2Props> = ({ onNext, onSkip, onBack }) => {
    const debugTypeMetrics = React.useMemo(() => {
        if (typeof window === 'undefined') return DEBUG_WELCOME2_TYPE;
        const params = new URLSearchParams(window.location.search);
        return DEBUG_WELCOME2_TYPE || params.get('debugType') === '1';
    }, []);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const builtTimeline = React.useMemo(
        () => buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE),
        [MANIFESTO_TEXT, DEFAULT_CADENCE]
    );
    const { visibleText, visibleCharCount, phase, elapsedMs, seekToMs } = useTypedTimeline(builtTimeline, {
        debugTypeMetrics,
    });
    const sentenceSpans = React.useMemo(
        () => buildWelcome2SentenceSpans(builtTimeline.renderText),
        [builtTimeline.renderText]
    );
    const lastTypedCharMs = React.useMemo(() => {
        if (builtTimeline.events.length === 0) return 0;
        return builtTimeline.events[builtTimeline.events.length - 1].tMs;
    }, [builtTimeline.events]);
    const autoAdvanceTriggeredRef = React.useRef(false);
    const autoAdvanceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAdvanceRef = React.useRef(0);
    const prevVisibleCountRef = React.useRef(visibleCharCount);
    const holdStartRef = React.useRef<number | null>(null);
    const prevCursorModeRef = React.useRef<TypingCursorMode>('typing');
    const lastLeftClickAtRef = React.useRef(0);
    const backChainUntilRef = React.useRef(0);
    const hasManualSeekRef = React.useRef(false);
    const backStepLandingSentenceIdxRef = React.useRef<number | null>(null);
    const backStepLandingStartCharCountRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (visibleCharCount === prevVisibleCountRef.current) return;
        prevVisibleCountRef.current = visibleCharCount;
        lastAdvanceRef.current = elapsedMs;
    }, [elapsedMs, visibleCharCount]);

    React.useEffect(() => {
        if (phase !== 'hold') {
            holdStartRef.current = null;
            return;
        }
        if (holdStartRef.current === null) {
            holdStartRef.current = elapsedMs;
        }
    }, [elapsedMs, phase]);

    let cursorMode: TypingCursorMode = 'typing';
    if (phase === 'typing') {
        const paused = elapsedMs - lastAdvanceRef.current > CURSOR_PAUSE_THRESHOLD_MS;
        cursorMode = paused ? 'pause' : 'typing';
    } else if (phase === 'hold') {
        const holdStartMs = holdStartRef.current ?? elapsedMs;
        const holdElapsedMs = elapsedMs - holdStartMs;
        cursorMode = holdElapsedMs < CURSOR_HOLD_FAST_WINDOW_MS ? 'holdFast' : 'normal';
    } else {
        cursorMode = 'normal';
    }

    React.useEffect(() => {
        if (!DEBUG_WELCOME2_CURSOR) return;
        if (prevCursorModeRef.current === cursorMode) return;
        prevCursorModeRef.current = cursorMode;
        console.log('[Welcome2Type] cursorMode=%s phase=%s elapsedMs=%d visibleCharCount=%d', cursorMode, phase, elapsedMs, visibleCharCount);
    }, [cursorMode, elapsedMs, phase, visibleCharCount]);

    React.useEffect(() => {
        if (!rootRef.current) return;
        rootRef.current.focus({ preventScroll: true });
    }, []);

    React.useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (DEBUG_WELCOME2_INPUT_GUARD) {
                console.log('[Welcome2Type] wheel prevented');
            }
        };

        root.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            root.removeEventListener('wheel', onWheel);
        };
    }, []);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!BLOCKED_SCROLL_KEYS.has(event.key)) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR)) {
            return;
        }
        event.preventDefault();
        if (DEBUG_WELCOME2_INPUT_GUARD) {
            console.log('[Welcome2Type] key prevented=%s', event.key);
        }
    }, []);

    const handlePointerDown = React.useCallback(() => {
        if (!rootRef.current) return;
        rootRef.current.focus({ preventScroll: true });
    }, []);

    const clearAutoAdvanceTimer = React.useCallback(() => {
        if (autoAdvanceTimeoutRef.current !== null) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
    }, []);

    const toSentenceEndTargetMs = React.useCallback((targetCharCount: number): number => {
        if (targetCharCount <= 0) return 0;
        const maxCount = builtTimeline.events.length;
        const clampedCharCount = Math.max(0, Math.min(targetCharCount, maxCount));
        if (clampedCharCount <= 0) return 0;
        return builtTimeline.events[clampedCharCount - 1].tMs;
    }, [builtTimeline.events]);

    const toSentenceStartTargetMs = React.useCallback((startCharCount: number): number => {
        const maxCount = builtTimeline.events.length;
        const clampedStart = Math.max(0, Math.min(startCharCount, maxCount));
        if (clampedStart <= 0) return 0;
        const startEvent = builtTimeline.events[clampedStart];
        if (!startEvent) return builtTimeline.totalMs;
        return Math.max(0, startEvent.tMs - 1);
    }, [builtTimeline.events, builtTimeline.totalMs]);

    const seekWithManualInteraction = React.useCallback((targetMs: number) => {
        hasManualSeekRef.current = true;
        clearAutoAdvanceTimer();
        seekToMs(targetMs);
        clearAutoAdvanceTimer();
        rootRef.current?.focus({ preventScroll: true });
    }, [clearAutoAdvanceTimer, seekToMs]);

    const getCurrentSentenceIdx = React.useCallback(() => {
        const probeIndex = visibleCharCount <= 0 ? 0 : visibleCharCount - 1;
        return sentenceIndexForCharCount(
            probeIndex,
            sentenceSpans.sentenceEndSoftCharCountByIndex
        );
    }, [sentenceSpans.sentenceEndSoftCharCountByIndex, visibleCharCount]);

    const getBackStepLandCharCount = React.useCallback((sentenceIdx: number): number => {
        const start = sentenceSpans.sentenceStartCharCountByIndex[sentenceIdx] ?? 0;
        const endCore = sentenceSpans.sentenceEndCoreCharCountByIndex[sentenceIdx] ?? start;
        const len = Math.max(0, endCore - start);
        if (len <= 0) return Math.max(0, endCore);
        const rawLand = start + Math.max(1, Math.floor(len * BACKSTEP_LAND_RATIO));
        const minLand = Math.min(endCore, start + 1);
        return Math.max(minLand, Math.min(rawLand, endCore));
    }, [
        sentenceSpans.sentenceEndCoreCharCountByIndex,
        sentenceSpans.sentenceStartCharCountByIndex,
    ]);

    const restartCurrentSentence = React.useCallback(() => {
        if (builtTimeline.events.length === 0) return;
        backStepLandingSentenceIdxRef.current = null;
        backStepLandingStartCharCountRef.current = null;
        const sentenceIdx = getCurrentSentenceIdx();
        const targetCharCount = sentenceSpans.sentenceStartCharCountByIndex[sentenceIdx] ?? 0;
        seekWithManualInteraction(toSentenceStartTargetMs(targetCharCount));
    }, [
        builtTimeline.events.length,
        getCurrentSentenceIdx,
        seekWithManualInteraction,
        sentenceSpans.sentenceStartCharCountByIndex,
        toSentenceStartTargetMs,
    ]);

    const goBackOneSentence = React.useCallback(() => {
        if (builtTimeline.events.length === 0) return;
        const sentenceIdx = getCurrentSentenceIdx();
        const prevSentenceIdx = Math.max(0, sentenceIdx - 1);
        backStepLandingSentenceIdxRef.current = prevSentenceIdx;
        const targetCharCount = getBackStepLandCharCount(prevSentenceIdx);
        backStepLandingStartCharCountRef.current = targetCharCount;
        seekWithManualInteraction(toSentenceEndTargetMs(targetCharCount));
    }, [
        builtTimeline.events.length,
        getBackStepLandCharCount,
        getCurrentSentenceIdx,
        seekWithManualInteraction,
        toSentenceEndTargetMs,
    ]);

    const finishCurrentSentence = React.useCallback(() => {
        if (builtTimeline.events.length === 0) return;
        backStepLandingSentenceIdxRef.current = null;
        backStepLandingStartCharCountRef.current = null;
        const sentenceIdx = getCurrentSentenceIdx();
        const targetCharCount =
            sentenceSpans.sentenceEndSoftCharCountByIndex[sentenceIdx] ?? builtTimeline.events.length;
        if (targetCharCount <= visibleCharCount) {
            rootRef.current?.focus({ preventScroll: true });
            return;
        }
        seekWithManualInteraction(toSentenceEndTargetMs(targetCharCount));
    }, [
        builtTimeline.events.length,
        getCurrentSentenceIdx,
        seekWithManualInteraction,
        sentenceSpans.sentenceEndSoftCharCountByIndex,
        toSentenceEndTargetMs,
        visibleCharCount,
    ]);

    const backStepEllipsisText = React.useMemo(() => {
        const landingSentenceIdx = backStepLandingSentenceIdxRef.current;
        const landingStartCharCount = backStepLandingStartCharCountRef.current;
        if (landingSentenceIdx === null || landingStartCharCount === null) return '';
        const currentSentenceIdx = getCurrentSentenceIdx();
        if (currentSentenceIdx !== landingSentenceIdx) return '';
        const endCore = sentenceSpans.sentenceEndCoreCharCountByIndex[currentSentenceIdx] ?? builtTimeline.events.length;
        if (visibleCharCount >= endCore) return '';
        const charsSinceLanding = Math.max(0, visibleCharCount - landingStartCharCount);
        const dotStepsConsumed = Math.floor(charsSinceLanding / BACKSTEP_ELLIPSIS_CHARS_PER_DOT_STEP);
        const dotCount = Math.max(0, BACKSTEP_ELLIPSIS_START_DOTS - dotStepsConsumed);
        if (dotCount <= 0) return '';
        return '.'.repeat(dotCount);
    }, [
        builtTimeline.events.length,
        getCurrentSentenceIdx,
        sentenceSpans.sentenceEndCoreCharCountByIndex,
        visibleCharCount,
    ]);

    React.useEffect(() => {
        if (backStepEllipsisText.length > 0) return;
        const landingSentenceIdx = backStepLandingSentenceIdxRef.current;
        if (landingSentenceIdx === null) return;
        backStepLandingSentenceIdxRef.current = null;
        backStepLandingStartCharCountRef.current = null;
    }, [backStepEllipsisText]);

    const handleSeekRestartSentence = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        clearAutoAdvanceTimer();
        const now = performance.now();

        if (now < backChainUntilRef.current) {
            goBackOneSentence();
            backChainUntilRef.current = now + CHAIN_WINDOW_MS;
            lastLeftClickAtRef.current = now;
            rootRef.current?.focus({ preventScroll: true });
            return;
        }

        const isDoubleClick = now - lastLeftClickAtRef.current <= DOUBLE_CLICK_MS;
        if (isDoubleClick) {
            goBackOneSentence();
            backChainUntilRef.current = now + CHAIN_WINDOW_MS;
            lastLeftClickAtRef.current = 0;
            rootRef.current?.focus({ preventScroll: true });
            return;
        }

        restartCurrentSentence();
        lastLeftClickAtRef.current = now;
        backChainUntilRef.current = 0;
        rootRef.current?.focus({ preventScroll: true });
    }, [
        goBackOneSentence,
        restartCurrentSentence,
        clearAutoAdvanceTimer,
    ]);

    const handleSeekFinishSentence = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        finishCurrentSentence();
    }, [
        finishCurrentSentence,
    ]);

    React.useEffect(() => {
        if (phase !== 'typing') return;
        clearAutoAdvanceTimer();
    }, [clearAutoAdvanceTimer, phase]);

    React.useEffect(() => {
        if (autoAdvanceTriggeredRef.current) return;
        if (autoAdvanceTimeoutRef.current !== null) return;
        if (builtTimeline.events.length === 0) return;
        if (hasManualSeekRef.current) return;
        if (phase === 'typing') return;

        const autoAdvanceAtMs = lastTypedCharMs + WELCOME2_AUTO_ADVANCE_DELAY_MS;
        const remainingMs = Math.max(0, autoAdvanceAtMs - elapsedMs);
        autoAdvanceTimeoutRef.current = setTimeout(() => {
            autoAdvanceTimeoutRef.current = null;
            if (autoAdvanceTriggeredRef.current) return;
            autoAdvanceTriggeredRef.current = true;
            onNext();
        }, remainingMs);
    }, [builtTimeline.events.length, elapsedMs, lastTypedCharMs, onNext, phase]);

    React.useEffect(() => {
        return () => {
            clearAutoAdvanceTimer();
        };
    }, [clearAutoAdvanceTimer]);

    return (
        <div
            ref={rootRef}
            style={ROOT_STYLE}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
        >
            <div style={CONTENT_STYLE}>
                <div
                    id="welcome2-manifesto-text"
                    className="welcome2-typable-text"
                    style={TEXT_STYLE}
                >
                    <span>{visibleText}</span>
                    {backStepEllipsisText ? <span style={ELLIPSIS_STYLE}>{backStepEllipsisText}</span> : null}
                    <TypingCursor mode={cursorMode} heightEm={0.95} style={CURSOR_STYLE} />
                </div>

                <div style={SEEK_BUTTON_ROW_STYLE} onPointerDown={(event) => event.stopPropagation()}>
                    <button
                        type="button"
                        style={SEEK_BUTTON_STYLE}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleSeekRestartSentence}
                    >
                        {'[<-]'}
                    </button>
                    <button
                        type="button"
                        style={SEEK_BUTTON_STYLE}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleSeekFinishSentence}
                    >
                        {'[->]'}
                    </button>
                </div>

                {SHOW_ONBOARDING_AUX_BUTTONS ? (
                    <div style={BUTTON_ROW_STYLE}>
                        <button type="button" style={BUTTON_STYLE} onClick={onBack}>
                            Back
                        </button>
                        <button type="button" style={BUTTON_STYLE} onClick={onSkip}>
                            Skip
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '64px',
    background: '#06060A',
    color: '#e7e7e7',
    boxSizing: 'border-box',
    outline: SHOW_WELCOME2_FOCUS_RING ? undefined : 'none',
};

const CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    maxWidth: '760px',
    width: '100%',
};

const TEXT_STYLE: React.CSSProperties = {
    fontSize: '18px',
    lineHeight: 1.8,
    color: '#b9bcc5',
    whiteSpace: 'pre-wrap',
    fontFamily: 'var(--font-ui)',
    fontVariantLigatures: 'none',
    fontKerning: 'none',
    fontFeatureSettings: '"kern" 0, "liga" 0, "clig" 0, "calt" 0',
    textRendering: 'auto',
};

const CURSOR_STYLE: React.CSSProperties = {
    marginLeft: '4px',
};

const ELLIPSIS_STYLE: React.CSSProperties = {
    opacity: 0.8,
};

const SEEK_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
};

const SEEK_BUTTON_STYLE: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '7px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: '#9db7e2',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    letterSpacing: 0.3,
};

const BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
};

const BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: '#c7cbd6',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'var(--font-ui)',
};
