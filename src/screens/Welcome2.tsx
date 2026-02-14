import React from 'react';
import { DEFAULT_CADENCE } from '../config/onboardingCadence';
import { SHOW_ONBOARDING_AUX_BUTTONS } from '../config/onboardingUiFlags';
import { TypingCursor, type TypingCursorMode } from '../components/TypingCursor';
import { useTypedTimeline } from '../hooks/useTypedTimeline';
import arrowLeftIcon from '../assets/arrow_left.png';
import arrowRightIcon from '../assets/arrow_right.png';
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
const WELCOME2_AUTO_ADVANCE_DELAY_MS = 2000;
const STABILIZE_STAGE_A_MS = 400;
const STABILIZE_STAGE_B_MS = 200;
const BACKSTEP_CUT_RATIO = 0.7;
const SEEK_ICON_SIZE_PX = 16;
const SEEK_ICON_COLOR = '#9db7e2';
const CONTINUE_BUTTON_LABEL = 'Continue';
const BLOCKED_SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp']);
const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a[href], [role=\"button\"], [contenteditable=\"true\"]';
const DEBUG_WELCOME2_TYPE = false;

export const Welcome2: React.FC<Welcome2Props> = ({ onNext, onSkip, onBack }) => {
    const debugForensic = React.useMemo(() => {
        if (typeof window === 'undefined') return import.meta.env.DEV;
        const params = new URLSearchParams(window.location.search);
        return import.meta.env.DEV || params.get('debugCadence') === '1';
    }, []);
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
    const {
        visibleText,
        visibleCharCount,
        phase,
        elapsedMs,
        isTextFullyRevealed,
        isDone,
        lastCharTimeMs,
        timeToDoneMs,
        seekToMs,
        setClockPaused,
    } = useTypedTimeline(builtTimeline, {
        debugTypeMetrics,
    });
    const sentenceSpans = React.useMemo(
        () => buildWelcome2SentenceSpans(builtTimeline.renderText),
        [builtTimeline.renderText]
    );
    const autoAdvanceTriggeredRef = React.useRef(false);
    const autoAdvanceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAdvanceRef = React.useRef(0);
    const prevVisibleCountRef = React.useRef(visibleCharCount);
    const holdStartRef = React.useRef<number | null>(null);
    const prevCursorModeRef = React.useRef<TypingCursorMode>('typing');
    const hasManualSeekRef = React.useRef(false);
    const wasContinueAvailableRef = React.useRef(false);
    const stabilizeTimeoutARef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const stabilizeTimeoutBRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const stabilizeTimeoutCRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const backJumpEpochRef = React.useRef(0);
    const isBackJumpingRef = React.useRef(false);
    const stabilizeStageRef = React.useRef<'cur_start' | 'prev_end' | null>(null);
    const [stabilizeStage, setStabilizeStage] = React.useState<'cur_start' | 'prev_end' | null>(null);

    const isContinueAvailable = hasManualSeekRef.current && isTextFullyRevealed;

    React.useEffect(() => {
        if (visibleCharCount === prevVisibleCountRef.current) return;
        prevVisibleCountRef.current = visibleCharCount;
        lastAdvanceRef.current = elapsedMs;
    }, [elapsedMs, visibleCharCount]);

    React.useEffect(() => {
        if (!debugForensic) return;
        if (!isContinueAvailable) {
            wasContinueAvailableRef.current = false;
            return;
        }
        if (wasContinueAvailableRef.current) return;
        wasContinueAvailableRef.current = true;
        console.log('[w2] continue available');
    }, [debugForensic, isContinueAvailable]);

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
    if (stabilizeStage !== null) {
        cursorMode = 'normal';
    } else if (phase === 'typing') {
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

    const continueToNext = React.useCallback(() => {
        if (!isContinueAvailable) return;
        if (autoAdvanceTriggeredRef.current) return;
        autoAdvanceTriggeredRef.current = true;
        clearAutoAdvanceTimer();
        if (debugForensic) {
            console.log('[w2] continue click -> onNext');
        }
        onNext();
    }, [clearAutoAdvanceTimer, debugForensic, isContinueAvailable, onNext]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (isContinueAvailable && (event.key === 'Enter' || event.key === 'ArrowRight')) {
            event.preventDefault();
            continueToNext();
            return;
        }
        if (!BLOCKED_SCROLL_KEYS.has(event.key)) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR)) {
            return;
        }
        event.preventDefault();
        if (DEBUG_WELCOME2_INPUT_GUARD) {
            console.log('[Welcome2Type] key prevented=%s', event.key);
        }
    }, [continueToNext, isContinueAvailable]);

    const setBackJumpStage = React.useCallback((stage: 'cur_start' | 'prev_end' | null) => {
        stabilizeStageRef.current = stage;
        setStabilizeStage(stage);
    }, []);

    const cancelBackJumpSequence = React.useCallback(() => {
        backJumpEpochRef.current += 1;
        if (stabilizeTimeoutARef.current !== null) {
            clearTimeout(stabilizeTimeoutARef.current);
            stabilizeTimeoutARef.current = null;
        }
        if (stabilizeTimeoutBRef.current !== null) {
            clearTimeout(stabilizeTimeoutBRef.current);
            stabilizeTimeoutBRef.current = null;
        }
        if (stabilizeTimeoutCRef.current !== null) {
            clearTimeout(stabilizeTimeoutCRef.current);
            stabilizeTimeoutCRef.current = null;
        }
        isBackJumpingRef.current = false;
        setBackJumpStage(null);
        setClockPaused(false);
    }, [setBackJumpStage, setClockPaused]);

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
        if (clampedStart <= 0) return -1;
        const startEvent = builtTimeline.events[clampedStart];
        if (!startEvent) return builtTimeline.totalMs;
        return Math.max(0, startEvent.tMs - 1);
    }, [builtTimeline.events, builtTimeline.totalMs]);

    const seekWithManualInteraction = React.useCallback((targetMs: number, source: string) => {
        if (debugForensic) {
            console.log('[w2] manual seek', {
                source,
                ms: targetMs,
                epoch: backJumpEpochRef.current,
                before: hasManualSeekRef.current,
            });
        }
        hasManualSeekRef.current = true;
        clearAutoAdvanceTimer();
        seekToMs(targetMs);
        clearAutoAdvanceTimer();
        rootRef.current?.focus({ preventScroll: true });
    }, [clearAutoAdvanceTimer, debugForensic, seekToMs]);

    const seekWithoutManualInteraction = React.useCallback((targetMs: number, source: string) => {
        if (debugForensic) {
            console.log('[w2] seek', {
                source,
                ms: targetMs,
                epoch: backJumpEpochRef.current,
            });
        }
        clearAutoAdvanceTimer();
        seekToMs(targetMs);
        clearAutoAdvanceTimer();
        rootRef.current?.focus({ preventScroll: true });
    }, [clearAutoAdvanceTimer, debugForensic, seekToMs]);

    const getCurrentPartIdx = React.useCallback(() => {
        const probeIndex = visibleCharCount <= 0 ? 0 : visibleCharCount - 1;
        return sentenceIndexForCharCount(
            probeIndex,
            sentenceSpans.partEndSoftCharCountByIndex
        );
    }, [sentenceSpans.partEndSoftCharCountByIndex, visibleCharCount]);

    const goPreviousPartWithStabilize = React.useCallback(() => {
        if (builtTimeline.events.length === 0) return;
        const currentPartIdx = getCurrentPartIdx();

        clearAutoAdvanceTimer();
        cancelBackJumpSequence();
        if (currentPartIdx <= 0) {
            rootRef.current?.focus({ preventScroll: true });
            return;
        }
        const localEpoch = backJumpEpochRef.current;

        const previousPartIdx = currentPartIdx - 1;
        isBackJumpingRef.current = true;
        setClockPaused(true);

        const currentPartStart = sentenceSpans.partStartCharCountByIndex[currentPartIdx] ?? 0;
        const targetMsA = toSentenceStartTargetMs(currentPartStart);
        const previousPartEndCore = sentenceSpans.partEndCoreCharCountByIndex[previousPartIdx] ?? 0;
        const targetMsB = toSentenceEndTargetMs(previousPartEndCore);
        const previousPartStart = sentenceSpans.partStartCharCountByIndex[previousPartIdx] ?? 0;
        const previousPartLen = Math.max(0, previousPartEndCore - previousPartStart);
        const cutWithinPart = previousPartLen <= 0
            ? 0
            : Math.max(1, Math.min(Math.floor(previousPartLen * BACKSTEP_CUT_RATIO), previousPartLen));
        const cutCharCount = previousPartLen <= 0
            ? previousPartEndCore
            : previousPartStart + cutWithinPart;
        const targetMsC = toSentenceEndTargetMs(cutCharCount);

        setBackJumpStage('cur_start');
        seekWithManualInteraction(targetMsA, 'restart_click_stageA');

        stabilizeTimeoutARef.current = setTimeout(() => {
            if (backJumpEpochRef.current !== localEpoch) return;
            stabilizeTimeoutARef.current = null;
            setBackJumpStage('prev_end');
            seekWithoutManualInteraction(targetMsB, 'restart_stageB');
            stabilizeTimeoutBRef.current = setTimeout(() => {
                if (backJumpEpochRef.current !== localEpoch) return;
                stabilizeTimeoutBRef.current = null;
                stabilizeTimeoutCRef.current = setTimeout(() => {
                    if (backJumpEpochRef.current !== localEpoch) return;
                    stabilizeTimeoutCRef.current = null;
                    seekWithoutManualInteraction(targetMsC, 'restart_stageC');
                    setBackJumpStage(null);
                    isBackJumpingRef.current = false;
                    setClockPaused(false);
                }, 0);
            }, STABILIZE_STAGE_B_MS);
        }, STABILIZE_STAGE_A_MS);
    }, [
        builtTimeline.events.length,
        clearAutoAdvanceTimer,
        cancelBackJumpSequence,
        getCurrentPartIdx,
        seekWithManualInteraction,
        seekWithoutManualInteraction,
        sentenceSpans.partEndCoreCharCountByIndex,
        setBackJumpStage,
        setClockPaused,
        sentenceSpans.partStartCharCountByIndex,
        toSentenceEndTargetMs,
        toSentenceStartTargetMs,
    ]);

    const finishCurrentSentence = React.useCallback(() => {
        if (builtTimeline.events.length === 0) return;
        const sentenceIdx = getCurrentPartIdx();
        const targetCharCount =
            sentenceSpans.partEndSoftCharCountByIndex[sentenceIdx] ?? builtTimeline.events.length;
        if (targetCharCount <= visibleCharCount) {
            rootRef.current?.focus({ preventScroll: true });
            return;
        }
        seekWithManualInteraction(toSentenceEndTargetMs(targetCharCount), 'finish_click_soft_end');
    }, [
        builtTimeline.events.length,
        getCurrentPartIdx,
        seekWithManualInteraction,
        sentenceSpans.partEndSoftCharCountByIndex,
        toSentenceEndTargetMs,
        visibleCharCount,
    ]);

    const handleSeekRestartSentence = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        goPreviousPartWithStabilize();
        rootRef.current?.focus({ preventScroll: true });
    }, [
        goPreviousPartWithStabilize,
    ]);

    const handleSeekFinishSentence = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        cancelBackJumpSequence();
        finishCurrentSentence();
    }, [
        cancelBackJumpSequence,
        finishCurrentSentence,
    ]);

    React.useEffect(() => {
        if (debugForensic) {
            console.log('[w2] auto-advance check', {
                phase,
                elapsedMs,
                totalMs: builtTimeline.totalMs,
                lastCharTimeMs,
                isTextFullyRevealed,
                isDone,
                hasManualSeek: hasManualSeekRef.current,
                stabilizeStage,
            });
        }
        if (autoAdvanceTriggeredRef.current) return;
        if (autoAdvanceTimeoutRef.current !== null) return;
        if (builtTimeline.events.length === 0) return;
        if (hasManualSeekRef.current) return;
        if (isDone) return;

        const remainingMs = Math.max(0, timeToDoneMs + WELCOME2_AUTO_ADVANCE_DELAY_MS);
        if (debugForensic) {
            console.log('[w2] auto-advance schedule', {
                remainingMs,
                delayMs: WELCOME2_AUTO_ADVANCE_DELAY_MS,
                timeToDoneMs,
            });
        }
        autoAdvanceTimeoutRef.current = setTimeout(() => {
            autoAdvanceTimeoutRef.current = null;
            if (autoAdvanceTriggeredRef.current) return;
            autoAdvanceTriggeredRef.current = true;
            if (debugForensic) {
                console.log('[w2] auto-advance fire');
                console.log('[w2] onNext invoke');
            }
            onNext();
        }, remainingMs);
    }, [
        builtTimeline.events.length,
        builtTimeline.totalMs,
        debugForensic,
        elapsedMs,
        isDone,
        isTextFullyRevealed,
        lastCharTimeMs,
        onNext,
        phase,
        stabilizeStage,
        timeToDoneMs,
    ]);

    React.useEffect(() => {
        return () => {
            cancelBackJumpSequence();
            clearAutoAdvanceTimer();
        };
    }, [cancelBackJumpSequence, clearAutoAdvanceTimer]);

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
                    <TypingCursor mode={cursorMode} heightEm={0.95} style={CURSOR_STYLE} />
                </div>

                <div style={SEEK_BUTTON_ROW_STYLE} onPointerDown={(event) => event.stopPropagation()}>
                    <button
                        type="button"
                        style={SEEK_BUTTON_STYLE}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleSeekRestartSentence}
                        aria-label="Jump backward"
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                ...SEEK_ICON_STYLE,
                                WebkitMaskImage: `url(${arrowLeftIcon})`,
                                maskImage: `url(${arrowLeftIcon})`,
                            }}
                        />
                    </button>
                    <button
                        type="button"
                        style={SEEK_BUTTON_STYLE}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleSeekFinishSentence}
                        aria-label="Jump forward"
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                ...SEEK_ICON_STYLE,
                                WebkitMaskImage: `url(${arrowRightIcon})`,
                                maskImage: `url(${arrowRightIcon})`,
                            }}
                        />
                    </button>
                </div>
                {isContinueAvailable ? (
                    <div style={CONTINUE_ROW_STYLE} onPointerDown={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            style={CONTINUE_BUTTON_STYLE}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={continueToNext}
                            aria-label="Continue to prompt"
                        >
                            {CONTINUE_BUTTON_LABEL}
                        </button>
                    </div>
                ) : null}

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

const SEEK_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
};

const CONTINUE_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
};

const CONTINUE_BUTTON_STYLE: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: '7px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: '#d8deea',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    letterSpacing: 0.2,
};

const SEEK_BUTTON_STYLE: React.CSSProperties = {
    width: '38px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: SEEK_ICON_COLOR,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    letterSpacing: 0.3,
};

const SEEK_ICON_STYLE: React.CSSProperties = {
    width: `${SEEK_ICON_SIZE_PX}px`,
    height: `${SEEK_ICON_SIZE_PX}px`,
    display: 'inline-block',
    flexShrink: 0,
    backgroundColor: SEEK_ICON_COLOR,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
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
