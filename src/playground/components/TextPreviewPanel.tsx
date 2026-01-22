import React from 'react';
import { useDocument } from '../../store/documentStore';

/**
 * Left-side sliding panel showing extracted text from parsed document
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const PANEL_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '400px',
    height: '100%',
    backgroundColor: 'rgba(15, 15, 26, 0.95)',
    borderRight: '1px solid rgba(99, 171, 255, 0.2)',
    backdropFilter: 'blur(12px)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'rgba(180, 190, 210, 0.9)',
};

const HEADER_STYLE: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(99, 171, 255, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'rgba(180, 190, 210, 0.7)',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px 8px',
    transition: 'color 0.2s ease',
};

const CONTENT_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
};

const META_STYLE: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(180, 190, 210, 0.6)',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(99, 171, 255, 0.1)',
};

export const TextPreviewPanel: React.FC = () => {
    const { state, setViewerMode } = useDocument();

    if (state.viewerMode !== 'open' || !state.activeDocument) {
        return null;
    }

    const doc = state.activeDocument;

    return (
        <div
            style={PANEL_STYLE}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
        >
            <div style={HEADER_STYLE}>
                <div>
                    <strong>📄 {doc.fileName}</strong>
                </div>
                <button
                    type="button"
                    style={CLOSE_BUTTON_STYLE}
                    onClick={() => setViewerMode('peek')}
                    aria-label="Close preview"
                    title="Close"
                >
                    ✕
                </button>
            </div>
            <div style={CONTENT_STYLE}>
                <div style={META_STYLE}>
                    <div>Type: {doc.sourceType.toUpperCase()}</div>
                    <div>Words: {doc.meta.wordCount.toLocaleString()}</div>
                    <div>Characters: {doc.meta.charCount.toLocaleString()}</div>
                    {doc.meta.pages && <div>Pages: {doc.meta.pages}</div>}
                    {doc.warnings.length > 0 && (
                        <div style={{ color: 'rgba(255, 180, 100, 0.8)', marginTop: '8px' }}>
                            ⚠️ {doc.warnings.join(', ')}
                        </div>
                    )}
                </div>
                {doc.text || <em style={{ color: 'rgba(180, 190, 210, 0.5)' }}>No text extracted</em>}
            </div>
        </div>
    );
};
