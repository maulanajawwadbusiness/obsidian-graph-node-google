import React from 'react';
import { createPortal } from 'react-dom';
import { usePortalRootEl, usePortalScopeMode } from '../components/portalScope/PortalScopeContext';
import { useGraphViewport } from '../runtime/viewport/graphViewport';
import {
    assertNoBodyPortalInBoxed,
    countBoxedSurfaceDisabled,
    isBoxedUi,
    resolveBoxedPortalTarget,
} from '../runtime/ui/boxedUiPolicy';

/**
 * PopupOverlayContainer
 *
 * Shared portal container for all popup modes:
 * - Normal popup (current)
 * - Seed popup (future)
 * - Mini chatbar
 *
 * This ensures consistent z-index layering and prevents
 * multiple portals from conflicting.
 */

const OVERLAY_STYLE_APP: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1000,
};

const OVERLAY_STYLE_CONTAINER: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1000,
};

interface PopupOverlayContainerProps {
    children: React.ReactNode;
}

export const PopupOverlayContainer: React.FC<PopupOverlayContainerProps> = ({ children }) => {
    const portalRoot = usePortalRootEl();
    const mode = usePortalScopeMode();
    const viewport = useGraphViewport();
    const boxed = isBoxedUi(viewport);
    const portalTarget = React.useMemo(() => {
        if (!boxed) return portalRoot;
        const safeTarget = resolveBoxedPortalTarget(portalRoot, 'PopupOverlayContainer');
        if (!safeTarget) return null;
        assertNoBodyPortalInBoxed(safeTarget, 'PopupOverlayContainer');
        return safeTarget;
    }, [boxed, portalRoot]);

    if (!portalTarget) {
        if (boxed) {
            countBoxedSurfaceDisabled('PopupOverlayContainer');
        }
        return null;
    }
    return createPortal(
        <div style={mode === 'container' ? OVERLAY_STYLE_CONTAINER : OVERLAY_STYLE_APP}>
            {children}
        </div>,
        portalTarget
    );
};

/**
 * Future: Seed Popup Host
 *
 * When seed popup module is integrated, it will render here:
 *
 * <PopupOverlayContainer>
 *   {mode === 'normal' && <NodePopup />}
 *   {mode === 'seed' && <SeedPopupHost config={...} />}
 *   {chatbarOpen && <MiniChatbar />}
 * </PopupOverlayContainer>
 *
 * SeedPopupHost will:
 * - Create SVG overlay for animation
 * - Manage 4-phase animation state
 * - Render contentNode in masked container
 * - Emit callbacks for phase changes
 */
