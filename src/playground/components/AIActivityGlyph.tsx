import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDocument } from '../../store/documentStore';
import { usePortalRootEl, usePortalScopeMode } from '../../components/portalScope/PortalScopeContext';
import { useGraphViewport } from '../../runtime/viewport/graphViewport';
import {
    assertBoxedPortalTarget,
    countBoxedSurfaceDisabled,
    isBoxedUi,
    resolveBoxedPortalTarget,
} from '../../runtime/ui/boxedUiPolicy';

/**
 * Minimal AI activity indicator - tiny dot with subtle pulse
 * Shows bottom-left while AI is generating labels
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const getGlyphContainerStyle = (viewerOpen: boolean): React.CSSProperties => ({
    position: 'fixed',
    bottom: '26px',
    left: viewerOpen ? 'calc(50vw + 160px)' : '160px', // Right of the toggle; shift into right region when viewer is open
    pointerEvents: 'none',  // Never block canvas interaction
    zIndex: 9999,  // Always on top
});

const getGlyphContainerStyleContainer = (viewerOpen: boolean): React.CSSProperties => ({
    ...getGlyphContainerStyle(viewerOpen),
    position: 'absolute',
});

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
    const portalRoot = usePortalRootEl();
    const mode = usePortalScopeMode();
    const viewport = useGraphViewport();
    const boxed = isBoxedUi(viewport);
    const portalTarget = React.useMemo(() => {
        if (!boxed) return portalRoot;
        assertBoxedPortalTarget(portalRoot, 'AIActivityGlyph');
        const safeTarget = resolveBoxedPortalTarget(portalRoot, 'AIActivityGlyph');
        if (!safeTarget) return null;
        return safeTarget;
    }, [boxed, portalRoot]);

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
    if (!portalTarget) {
        if (boxed) {
            countBoxedSurfaceDisabled('AIActivityGlyph');
        }
        return null;
    }

    return createPortal(
        <div
            style={mode === 'container' ? getGlyphContainerStyleContainer(state.previewOpen) : getGlyphContainerStyle(state.previewOpen)}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            aria-hidden="true"
        >
            <div style={DOT_STYLE} />
        </div>
    , portalTarget);
};
