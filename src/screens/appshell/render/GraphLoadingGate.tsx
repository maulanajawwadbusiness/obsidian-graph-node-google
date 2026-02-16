import React from 'react';
import { type GatePhase } from './graphLoadingGateMachine';

type GraphLoadingGateProps = {
    rootRef?: React.RefObject<HTMLDivElement>;
    phase: GatePhase;
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
    fontFamily: 'var(--font-ui)',
    pointerEvents: 'auto',
    touchAction: 'none',
    zIndex: 10,
};

const TEXT_STYLE: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 500,
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
    fontWeight: 500,
    userSelect: 'none',
};

const CONFIRM_BUTTON_STYLE: React.CSSProperties = {
    minWidth: '140px',
    height: '42px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.20)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#f2f2f2',
    fontSize: '14px',
    fontWeight: 600,
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
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#e7e7e7',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
};

const ERROR_TITLE_STYLE: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: 700,
    color: '#ffd5d5',
    marginBottom: '8px',
    textAlign: 'center',
};

const ERROR_MESSAGE_STYLE: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
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
    const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (!confirmVisible || !confirmEnabled) return;
        confirmButtonRef.current?.focus();
    }, [confirmEnabled, confirmVisible]);

    const onGateKeyDownCapture = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
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
    }, [confirmEnabled, onBackToPrompt, onConfirm]);

    return (
        <div
            ref={rootRef}
            data-graph-loading-gate="1"
            tabIndex={-1}
            style={ROOT_STYLE}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerMoveCapture={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
            onWheelCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDownCapture={onGateKeyDownCapture}
        >
            {isError ? (
                <div role="status" aria-live="assertive" style={TEXT_STYLE}>
                    <div style={ERROR_TITLE_STYLE}>Loading Failed</div>
                    <div style={ERROR_MESSAGE_STYLE}>{errorMessage || 'Analysis failed. Please try again.'}</div>
                </div>
            ) : (
                <div role="status" aria-live="polite" style={TEXT_STYLE}>
                    {isDone ? 'Loading Complete' : isStalled ? 'Loading stalled. Please go back to prompt.' : 'Loading...'}
                </div>
            )}
            {showBackToPrompt ? (
                <button
                    type="button"
                    style={BACK_BUTTON_STYLE}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onBackToPrompt?.()}
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
                        disabled={!confirmEnabled || isError}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onConfirm?.()}
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
