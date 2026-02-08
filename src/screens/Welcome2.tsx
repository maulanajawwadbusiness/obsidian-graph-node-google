import React from 'react';
import { DEFAULT_CADENCE } from '../config/onboardingCadence';
import { TypingCursor, type TypingCursorMode } from '../components/TypingCursor';
import { useTypedTimeline } from '../hooks/useTypedTimeline';
import { MANIFESTO_TEXT } from './welcome2ManifestoText';
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
const BLOCKED_SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp']);
const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a[href], [role=\"button\"], [contenteditable=\"true\"]';
const DEBUG_WELCOME2_TYPE = false;

export const Welcome2: React.FC<Welcome2Props> = ({ onNext, onSkip, onBack }) => {
    void onNext;
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
    const { visibleText, visibleCharCount, phase, elapsedMs } = useTypedTimeline(builtTimeline, {
        debugTypeMetrics,
    });
    const lastAdvanceRef = React.useRef(0);
    const prevVisibleCountRef = React.useRef(visibleCharCount);
    const holdStartRef = React.useRef<number | null>(null);
    const prevCursorModeRef = React.useRef<TypingCursorMode>('typing');

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

                <div style={BUTTON_ROW_STYLE}>
                    <button type="button" style={BUTTON_STYLE} onClick={onBack}>
                        Back
                    </button>
                    <button type="button" style={BUTTON_STYLE} onClick={onSkip}>
                        Skip
                    </button>
                </div>
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
