import React, { useMemo } from 'react';
import { useDocument } from '../../store/documentStore';
import { ArnvoidDocumentViewer } from '../../ArnvoidDocumentViewer';
import type { ViewerSource } from '../../ArnvoidDocumentViewer';
import { t } from '../../i18n/t';

type HalfLeftWindowProps = {
    open: boolean;
    onClose: () => void;
    rawFile: File | null;
};

const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 50%',
    height: '100%',
    backgroundColor: 'rgba(15, 15, 26, 0.98)',
    borderRight: '1px solid rgba(99, 171, 255, 0.2)',
    zIndex: 400,
    display: 'flex',
    flexDirection: 'column',
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
    fontWeight: 'var(--font-title-weight, 700)',
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
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    padding: 0,
    position: 'relative',
};

const EMPTY_STYLE: React.CSSProperties = {
    padding: '18px',
    border: '1px dashed rgba(99, 171, 255, 0.25)',
    borderRadius: '10px',
    color: 'rgba(180, 190, 210, 0.75)',
    background: 'rgba(0,0,0,0.12)',
    fontSize: '13px',
    lineHeight: 1.55,
};

export const HalfLeftWindow: React.FC<HalfLeftWindowProps> = ({ open, onClose, rawFile }) => {
    const { state } = useDocument();
    const source = useMemo<ViewerSource | null>(() => {
        if (rawFile) {
            return { kind: 'file', file: rawFile };
        }
        const doc = state.activeDocument;
        if (!doc) return null;
        const formatHint = doc.sourceType === 'md' ? 'md' : 'txt';
        return { kind: 'text', text: doc.text, formatHint };
    }, [rawFile, state.activeDocument]);

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

    return (
        <div
            data-font="ui"
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
                <div style={TITLE_STYLE} data-font="title">
                    {t('docViewer.title')}
                </div>
                <button type="button" style={CLOSE_BUTTON_STYLE} onClick={onClose} aria-label={t('tooltip.closeViewer')} title={t('tooltip.closeViewer')}>
                    ×
                </button>
            </div>

            <div style={BODY_STYLE} className="arnvoid-left-window">
                <ArnvoidDocumentViewer source={source} />
                {!source && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            padding: '18px 18px 24px 18px',
                            pointerEvents: 'none',
                        }}
                    >
                        <div style={EMPTY_STYLE}>
                            <strong style={{ display: 'block', marginBottom: '6px', color: 'rgba(220, 228, 245, 0.9)' }}>
                                {t('docViewer.empty')}
                            </strong>
                            <div>{t('docViewer.dropInstruction')}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
