import React from 'react';
import { createPortal } from 'react-dom';
import { usePortalRootEl } from '../components/portalScope/PortalScopeContext';

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

const OVERLAY_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none', // Children control their own pointer events
    zIndex: 1000,
};

interface PopupOverlayContainerProps {
    children: React.ReactNode;
}

export const PopupOverlayContainer: React.FC<PopupOverlayContainerProps> = ({ children }) => {
    const portalRoot = usePortalRootEl();
    return createPortal(
        <div style={OVERLAY_STYLE}>
            {children}
        </div>,
        portalRoot
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
