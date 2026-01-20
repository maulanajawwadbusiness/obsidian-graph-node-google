import React from 'react';
import { createPortal } from 'react-dom';
import { NodePopup } from './NodePopup';
import { usePopup } from './PopupStore';

/**
 * Popup Portal - Renders popup in document.body for z-index control
 */

const PORTAL_CONTAINER_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',  // Allow clicks through to canvas
    zIndex: 1000,
};

export const PopupPortal: React.FC = () => {
    const { isOpen } = usePopup();

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div style={PORTAL_CONTAINER_STYLE}>
            <NodePopup />
        </div>,
        document.body
    );
};
