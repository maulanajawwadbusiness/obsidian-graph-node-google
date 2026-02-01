import React from 'react';
import { useDocument } from '../../store/documentStore';
import { t } from '../../i18n/t';

/**
 * Bottom-left button to toggle the left viewer window.
 * Must work even with no document loaded (opens empty state).
 */

type TextPreviewButtonProps = {
    onToggle?: () => void;
};

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    padding: '8px 14px',
    fontSize: '13px',
    backgroundColor: 'rgba(20, 20, 30, 0.85)',
    color: 'rgba(180, 190, 210, 0.9)',
    border: '1px solid rgba(99, 171, 255, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.2s ease',
    zIndex: 100,
};

export const TextPreviewButton: React.FC<TextPreviewButtonProps> = ({ onToggle }) => {
    const { state, togglePreview } = useDocument();
    const open = state.previewOpen;

    return (
        <button
            type="button"
            style={BUTTON_STYLE}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onPointerDown={stopPropagation}
            onClick={(e) => {
                stopPropagation(e);
                (onToggle ?? togglePreview)();
            }}
            aria-label={open ? t('tooltip.closeViewer') : t('tooltip.openViewer')}
            title={open ? t('tooltip.closeViewer') : t('tooltip.openViewer')}
        >
            {open ? `✕ ${t('textPreview.close')}` : `📄 ${t('textPreview.open')}`}
        </button>
    );
};
