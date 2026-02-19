import React from 'react';
import { type GatePhase } from './graphLoadingGateMachine';
import { LOADING_TEXT_FONT_FAMILY, LOADING_TEXT_FONT_WEIGHT } from '../../../styles/loadingTypography';

export type GateVisualPhase = 'entering' | 'visible' | 'exiting';

type GraphLoadingGateProps = {
    rootRef?: React.RefObject<HTMLDivElement>;
    phase: GatePhase;
    visualPhase?: GateVisualPhase;
    fadeMs?: number;
    fadeEasing?: string;
    interactionLocked?: boolean;
    errorMessage?: string | null;
    confirmVisible?: boolean;
    confirmEnabled?: boolean;
    onConfirm?: () => void;
    showBackToPrompt?: boolean;
    onBackToPrompt?: () => void;
};

const ROOT_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    background: '#06060A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e7e7e7',
    fontFamily: LOADING_TEXT_FONT_FAMILY,
    pointerEvents: 'auto',
    touchAction: 'none',
    zIndex: 10,
};

const TEXT_STYLE: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
    letterSpacing: '0.3px',
    textAlign: 'center',
    lineHeight: 1.4,
    maxWidth: '700px',
    padding: '0 24px',
    boxSizing: 'border-box',
};

const CONFIRM_SLOT_STYLE: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: '36px',
    transform: 'translateX(-50%)',
    minWidth: '140px',
    height: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(231, 231, 231, 0.75)',
    fontSize: '14px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
    userSelect: 'none',
};

const CONFIRM_BUTTON_STYLE: React.CSSProperties = {
    minWidth: '140px',
    height: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.20)',
    background: '#0D0D18',
    color: '#f2f2f2',
    fontSize: '14px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
};

const CONFIRM_BUTTON_ENABLED_STYLE: React.CSSProperties = {
    opacity: 1,
    cursor: 'pointer',
};

const CONFIRM_BUTTON_DISABLED_STYLE: React.CSSProperties = {
    opacity: 0.5,
    cursor: 'not-allowed',
};

const BACK_BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '24px',
    left: '24px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: '#0D0D18',
    color: '#e7e7e7',
    padding: '0 14px',
    fontSize: '14px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
    cursor: 'pointer',
};

const ERROR_TITLE_STYLE: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
    color: '#ffd5d5',
    marginBottom: '8px',
    textAlign: 'center',
};

const ERROR_MESSAGE_STYLE: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: LOADING_TEXT_FONT_WEIGHT,
    color: 'rgba(255, 235, 235, 0.92)',
    textAlign: 'center',
    lineHeight: 1.45,
    maxWidth: '720px',
    padding: '0 24px',
    boxSizing: 'border-box',
};

export const GraphLoadingGate: React.FC<GraphLoadingGateProps> = ({
    rootRef,
    phase,
    visualPhase = 'visible',
    fadeMs = 200,
    fadeEasing = 'cubic-bezier(0.22, 1, 0.36, 1)',
    interactionLocked = false,
    errorMessage,
    confirmVisible = false,
    confirmEnabled = false,
    onConfirm,
    showBackToPrompt = false,
    onBackToPrompt,
}) => {
    const isDone = phase === 'done' || phase === 'confirmed';
    const isError = phase === 'error';
    const isStalled = phase === 'stalled';
    const isFadingOut = visualPhase === 'exiting';
    const isFadingIn = visualPhase === 'entering';
    const isInteractionBlocked = interactionLocked;
    const shouldBlockInput = interactionLocked && !isFadingOut;
    const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
    const warnedFadePointerEventsRef = React.useRef(false);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        const debugWindow = window as Window & {
            __arnvoidDebugCounters?: Record<string, number>;
        };
        const counters = (debugWindow.__arnvoidDebugCounters ??= {});
        counters.graphLoadingGateMountCount = (counters.graphLoadingGateMountCount ?? 0) + 1;
        return () => {
            counters.graphLoadingGateUnmountCount = (counters.graphLoadingGateUnmountCount ?? 0) + 1;
        };
    }, []);

    React.useEffect(() => {
        if (!confirmVisible || !confirmEnabled) return;
        confirmButtonRef.current?.focus();
    }, [confirmEnabled, confirmVisible]);

    const onGateKeyDownCapture = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (shouldBlockInput) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onBackToPrompt?.();
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            const target = event.target as HTMLElement | null;
            const isConfirmKeyTarget = Boolean(target?.closest('[data-gate-confirm="1"]'));
            if (confirmEnabled && isConfirmKeyTarget) {
                event.preventDefault();
                event.stopPropagation();
                onConfirm?.();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        }
    }, [confirmEnabled, onBackToPrompt, onConfirm, shouldBlockInput]);

    const rootVisualStyle: React.CSSProperties = {
        ...ROOT_STYLE,
        pointerEvents: isFadingOut ? 'none' : 'auto',
        opacity: isFadingIn || isFadingOut ? 0 : 1,
        transition: fadeMs > 0 ? `opacity ${fadeMs}ms ${fadeEasing}` : 'none',
    };

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (!isFadingOut) return;
        if (rootVisualStyle.pointerEvents === 'none') return;
        if (warnedFadePointerEventsRef.current) return;
        warnedFadePointerEventsRef.current = true;
        console.warn('[GateInputInvariant] fading_out_pointer_events_must_be_none');
    }, [isFadingOut, rootVisualStyle.pointerEvents]);

    return (
        <div
            ref={rootRef}
            data-graph-loading-gate="1"
            data-gate-visual-phase={visualPhase}
            data-gate-interaction-locked={shouldBlockInput ? '1' : '0'}
            tabIndex={-1}
            style={rootVisualStyle}
            onPointerDownCapture={(e) => {
                if (!shouldBlockInput) return;
                e.stopPropagation();
            }}
            onPointerMoveCapture={(e) => {
                if (!shouldBlockInput) return;
                e.stopPropagation();
            }}
            onPointerUpCapture={(e) => {
                if (!shouldBlockInput) return;
                e.stopPropagation();
            }}
            onWheelCapture={(e) => {
                if (!shouldBlockInput) return;
                e.preventDefault();
                e.stopPropagation();
            }}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDownCapture={onGateKeyDownCapture}
        >
            {isError ? (
                <div role="status" aria-live="assertive" style={TEXT_STYLE}>
                    <div style={ERROR_TITLE_STYLE}>Analysis Failed</div>
                    <div style={ERROR_MESSAGE_STYLE}>{errorMessage || 'Analysis failed. Please go back and try again.'}</div>
                </div>
            ) : (
                <div role="status" aria-live="polite" style={TEXT_STYLE}>
                    {isDone ? 'Loading Complete' : isStalled ? 'Loading stalled. Please go back to prompt.' : 'Loading...'}
                </div>
            )}
            {showBackToPrompt ? (
                <button
                    type="button"
                    style={{ ...BACK_BUTTON_STYLE, opacity: isInteractionBlocked ? 0.6 : 1 }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                        if (isInteractionBlocked) return;
                        onBackToPrompt?.();
                    }}
                    disabled={isInteractionBlocked}
                >
                    Back to Prompt
                </button>
            ) : null}
            <div style={{ ...CONFIRM_SLOT_STYLE, opacity: confirmVisible && !isError ? 1 : 0.35 }}>
                {confirmVisible ? (
                    <button
                        ref={confirmButtonRef}
                        data-gate-confirm="1"
                        type="button"
                        style={{
                            ...CONFIRM_BUTTON_STYLE,
                            ...(confirmEnabled ? CONFIRM_BUTTON_ENABLED_STYLE : CONFIRM_BUTTON_DISABLED_STYLE),
                        }}
                        disabled={!confirmEnabled || isError || isInteractionBlocked}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                            if (isInteractionBlocked) return;
                            onConfirm?.();
                        }}
                    >
                        Confirm
                    </button>
                ) : (
                    <span>Confirm</span>
                )}
            </div>
        </div>
    );
};
