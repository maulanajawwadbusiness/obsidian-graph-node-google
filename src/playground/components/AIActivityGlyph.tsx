import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDocument } from '../../store/documentStore';

/**
 * Minimal AI activity indicator - tiny dot with subtle pulse
 * Shows bottom-left while AI is generating labels
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const GLYPH_CONTAINER_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '26px',
    left: '160px',  // Right of TextPreviewButton
    pointerEvents: 'none',  // Never block canvas interaction
    zIndex: 9999,  // Always on top
};

const DOT_STYLE: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'rgba(99, 171, 255, 0.6)',
    animation: 'aiPulse 2s ease-in-out infinite',
};

const STYLE_TAG_ID = 'ai-activity-glyph-styles';

export const AIActivityGlyph: React.FC = () => {
    const { state } = useDocument();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        if (!document.getElementById(STYLE_TAG_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_TAG_ID;
            style.textContent = `
                @keyframes aiPulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Only show when AI is active
    if (!state.aiActivity || !mounted) {
        return null;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            style={GLYPH_CONTAINER_STYLE}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            aria-hidden="true"
            title="AI generating labels..."
        >
            <div style={DOT_STYLE} />
        </div>
    , document.body);
};
