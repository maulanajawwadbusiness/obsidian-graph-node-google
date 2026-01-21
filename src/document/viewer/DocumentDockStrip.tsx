import React from 'react';
import { useDocument } from '../../store/documentStore';
import './DocumentDockStrip.css';

/**
 * Document Dock Strip - Three-Layer Left Presence Strip
 * Layer 1: Spine (12px gradient) - always visible
 * Layer 2: Handle pill (22px × 64px) - always visible, toggles viewer
 * Layer 3: Peek sliver (32px) - only when doc loaded + peek mode
 *
 * The viewer is an organ, not a modal. It never fully disappears.
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const DocumentDockStrip: React.FC = () => {
    const { state, toggleViewer } = useDocument();
    const isPeek = state.viewerMode === 'peek';
    const hasDocument = !!state.activeDocument;
    const indicatorState = state.errorMessage
        ? 'warning'
        : hasDocument
            ? 'loaded'
            : 'idle';

    return (
        <div
            className="doc-dock-root"
            data-viewer-mode={isPeek ? 'peek' : 'open'}
            data-indicator={indicatorState}
        >
            <button
                type="button"
                className="doc-dock-spine"
                onClick={(e) => {
                    stopPropagation(e);
                    toggleViewer();
                }}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
                aria-label="Document viewer dock"
                title="Toggle document viewer"
            />

            {isPeek && hasDocument && <div className="doc-dock-peek" aria-hidden="true" />}

            <button
                type="button"
                className="doc-dock-handle"
                onClick={(e) => {
                    stopPropagation(e);
                    toggleViewer();
                }}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
                aria-label={`Toggle document viewer (currently ${isPeek ? 'closed' : 'open'})`}
                title={`Click to ${isPeek ? 'open' : 'close'} document viewer (Ctrl+\\)`}
            >
                <span className="doc-dock-dot" />
                <span className="doc-dock-chevron" />
            </button>
        </div>
    );
};
