import React from 'react';

type GraphLoadingGateProps = {
    showConfirmSlot?: boolean;
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
    pointerEvents: 'none',
    userSelect: 'none',
};

export const GraphLoadingGate: React.FC<GraphLoadingGateProps> = ({ showConfirmSlot = true }) => {
    return (
        <div
            data-graph-loading-gate="1"
            style={ROOT_STYLE}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onPointerMoveCapture={(e) => e.stopPropagation()}
            onPointerUpCapture={(e) => e.stopPropagation()}
            onWheelCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div style={TEXT_STYLE}>Loading...</div>
            {showConfirmSlot ? <div style={CONFIRM_SLOT_STYLE}>Confirm</div> : null}
        </div>
    );
};
