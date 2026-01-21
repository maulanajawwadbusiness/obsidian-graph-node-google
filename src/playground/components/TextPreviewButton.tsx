import React from 'react';
import { useDocument } from '../../store/documentStore';

/**
 * Bottom-left button to toggle text preview panel
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const TEXT_BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    padding: '8px 16px',
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

export const TextPreviewButton: React.FC = () => {
    const { state, toggleViewer } = useDocument();

    // Show button only when document is ready
    if (state.status !== 'ready' || !state.activeDocument) {
        return null;
    }

    return (
        <button
            type="button"
            style={TEXT_BUTTON_STYLE}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={(e) => {
                stopPropagation(e);
                toggleViewer();
            }}
            aria-label="Toggle text preview"
            title="Show extracted text"
        >
            📄 Text Preview
        </button>
    );
};
