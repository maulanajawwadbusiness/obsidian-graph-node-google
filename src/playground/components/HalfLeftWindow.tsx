import React from 'react';
import { useDocument } from '../../store/documentStore';

type HalfLeftWindowProps = {
    open: boolean;
    onClose: () => void;
};

const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 50%',
    height: '100%',
    backgroundColor: 'rgba(15, 15, 26, 0.98)',
    borderRight: '1px solid rgba(99, 171, 255, 0.2)',
    zIndex: 400,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'rgba(180, 190, 210, 0.9)',
    position: 'relative',
    pointerEvents: 'auto',
};

const HEADER_STYLE: React.CSSProperties = {
    height: '54px',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(99, 171, 255, 0.15)',
    flexShrink: 0,
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    letterSpacing: '0.2px',
    opacity: 0.85,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(180, 190, 210, 0.8)',
    cursor: 'pointer',
    borderRadius: '8px',
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
};

const BODY_STYLE: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    padding: '18px 18px 24px 18px',
    lineHeight: 1.55,
    fontSize: '13px',
};

const EMPTY_STYLE: React.CSSProperties = {
    padding: '18px',
    border: '1px dashed rgba(99, 171, 255, 0.25)',
    borderRadius: '10px',
    color: 'rgba(180, 190, 210, 0.75)',
    background: 'rgba(0,0,0,0.12)',
};

export const HalfLeftWindow: React.FC<HalfLeftWindowProps> = ({ open, onClose }) => {
    const { state } = useDocument();

    if (!open) return null;

    const stop = (e: unknown) => {
        const evt = e as { stopPropagation?: () => void };
        evt.stopPropagation?.();
    };

    const stopWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
    };

    const blockDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'none';
        }
    };

    const doc = state.activeDocument;

    return (
        <div
            style={{ ...PANEL_STYLE, touchAction: 'pan-x pan-y' }}
            onPointerDownCapture={stop}
            onPointerMoveCapture={stop}
            onPointerUpCapture={stop}
            onPointerCancelCapture={stop}
            onWheelCapture={stopWheel}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDragOverCapture={blockDrop}
            onDropCapture={blockDrop}
        >
            <div style={HEADER_STYLE}>
                <div style={TITLE_STYLE}>Document Viewer</div>
                <button type="button" style={CLOSE_BUTTON_STYLE} onClick={onClose} aria-label="Close viewer" title="Close">
                    ×
                </button>
            </div>

            <div style={BODY_STYLE}>
                {!doc ? (
                    <div style={EMPTY_STYLE}>
                        <strong style={{ display: 'block', marginBottom: '6px', color: 'rgba(220, 228, 245, 0.9)' }}>
                            No document loaded
                        </strong>
                        <div>Drop a file onto the canvas (right side) to parse it.</div>
                    </div>
                ) : (
                    <div style={EMPTY_STYLE}>
                        <strong style={{ display: 'block', marginBottom: '6px', color: 'rgba(220, 228, 245, 0.9)' }}>
                            Viewer placeholder
                        </strong>
                        <div style={{ marginBottom: '10px' }}>
                            Loaded: <span style={{ color: 'rgba(99, 171, 255, 0.9)' }}>{doc.fileName}</span>
                        </div>
                        <div style={{ opacity: 0.8 }}>
                            This panel will later host the multi-engine document viewer (TXT/MD/DOCX/PDF) and adapter wiring.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
