import React from 'react';
import { useDocument } from '../../store/documentStore';

const TITLE_BLOCK_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100, // Below overlays but above canvas
    pointerEvents: 'none', // Critical: pass clicks through to canvas
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    width: 'max-content',
    maxWidth: '480px'
};

const LABEL_STYLE: React.CSSProperties = {
    color: 'rgba(94, 114, 145, 0.6)', // "Dark Navy" vibe but legible on black (Slate Blue), dimmed
    fontSize: '13px',
    fontWeight: 400, // Not bold
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: 'system-ui, sans-serif'
};

const MAIN_TITLE_STYLE: React.CSSProperties = {
    color: 'rgba(212, 245, 255, 0.5)', // #edfbff at ~0.7 opacity (dimmed)
    fontSize: '16px',
    fontWeight: 300, // Light/Normal
    letterSpacing: '0.5px',
    fontFamily: 'system-ui, sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    padding: '0 16px', // Buffer for ellipsis
    textShadow: '0 2px 10px rgba(0,0,0,0.3)'
};

export const MapTitleBlock: React.FC = () => {
    const { state } = useDocument();

    // Determine what to show
    let mainText = 'Judul paper di sini'; // Indonesian fallback

    if (state.inferredTitle) {
        mainText = state.inferredTitle;
    } else if (state.activeDocument) {
        // Fallback to filename if analyzer hasn't finished or failed
        mainText = state.activeDocument.fileName.replace(/\.[^/.]+$/, "");
    }

    return (
        <div style={TITLE_BLOCK_STYLE}>
            <div style={LABEL_STYLE}>Peta Pengetahuan 2 Dimensi</div>
            <div style={MAIN_TITLE_STYLE} title={mainText}>
                "{mainText}"
            </div>
        </div>
    );
};
