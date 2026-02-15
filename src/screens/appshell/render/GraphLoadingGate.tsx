import React from 'react';

type GraphLoadingGateProps = {
    rootRef?: React.RefObject<HTMLDivElement>;
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
    opacity: 0.35,
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
    cursor: 'pointer',
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

export const GraphLoadingGate: React.FC<GraphLoadingGateProps> = ({
    rootRef,
    confirmVisible = false,
    confirmEnabled = false,
    onConfirm,
    showBackToPrompt = false,
    onBackToPrompt,
}) => {
    const isDone = confirmEnabled;
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
            event.preventDefault();
            event.stopPropagation();
            if (!confirmEnabled) return;
            onConfirm?.();
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
            <div role="status" aria-live="polite" style={TEXT_STYLE}>
                {isDone ? 'Loading Complete' : 'Loading...'}
            </div>
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
            <div style={CONFIRM_SLOT_STYLE}>
                {confirmVisible ? (
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        style={CONFIRM_BUTTON_STYLE}
                        disabled={!confirmEnabled}
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
