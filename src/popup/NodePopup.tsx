import React, { useEffect, useRef, useState } from 'react';
import { usePopup } from './PopupStore';

/**
 * Node Popup - Big mini-window that shows node info
 * Opens when user clicks a node, positions intelligently
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const GAP_FROM_NODE = 20; // px gap between node and popup

const POPUP_STYLE: React.CSSProperties = {
    position: 'absolute',
    width: '20vw',
    minWidth: '280px',
    height: '80vh',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid rgba(99, 171, 255, 0.3)',
    borderRadius: '8px',
    padding: '20px',
    color: 'rgba(180, 190, 210, 0.9)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',  // Enable clicks within popup
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: 'opacity 200ms ease-out, transform 200ms ease-out',
    opacity: 0,
    transform: 'scale(0.95) translateY(10px)',
};

const POPUP_VISIBLE_STYLE: React.CSSProperties = {
    opacity: 1,
    transform: 'scale(1) translateY(0)',
};

const HEADER_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(99, 171, 255, 0.2)',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'rgba(180, 190, 210, 0.7)',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
};

const CONTENT_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    fontSize: '14px',
    lineHeight: '1.6',
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: 'rgba(99, 171, 255, 0.9)',
};

function computePopupPosition(
    anchor: { x: number; y: number; radius: number },
    popupWidth: number,
    popupHeight: number
): { left: number; top: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Choose left or right based on space
    let left: number;
    if (anchor.x > viewportWidth / 2) {
        // Node is on right half → popup on left
        left = anchor.x - anchor.radius - GAP_FROM_NODE - popupWidth;
    } else {
        // Node is on left half → popup on right
        left = anchor.x + anchor.radius + GAP_FROM_NODE;
    }

    // Clamp horizontal to stay on screen
    const minLeft = 10;
    const maxLeft = viewportWidth - popupWidth - 10;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Vertical: try to center on node, clamp to viewport
    let top = anchor.y - popupHeight / 2;
    const minTop = 10;
    const maxTop = viewportHeight - popupHeight - 10;
    top = Math.max(minTop, Math.min(top, maxTop));

    return { left, top };
}

export const NodePopup: React.FC = () => {
    const { selectedNodeId, anchorGeometry, closePopup } = usePopup();
    const popupRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Trigger animation after mount
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, [selectedNodeId]); // Re-trigger on node switch

    // Smart positioning
    const position = anchorGeometry
        ? computePopupPosition(
            anchorGeometry,
            popupRef.current?.offsetWidth || 280,
            popupRef.current?.offsetHeight || window.innerHeight * 0.8
        )
        : { left: 0, top: 0 };

    // Close on ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closePopup();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closePopup]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                closePopup();
            }
        };

        // Small delay to avoid immediate close from the opening click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [closePopup]);

    // TODO: Get actual node data from engine
    // For now, using selectedNodeId as label placeholder
    const nodeLabel = selectedNodeId ? `Node ${selectedNodeId.slice(0, 8)}` : 'Unknown';

    const finalStyle = {
        ...POPUP_STYLE,
        ...(isVisible ? POPUP_VISIBLE_STYLE : {}),
        left: `${position.left}px`,
        top: `${position.top}px`,
    };

    return (
        <div
            ref={popupRef}
            style={finalStyle}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={stopPropagation}
        >
            <div style={HEADER_STYLE}>
                <span style={{ fontSize: '14px', opacity: 0.7 }}>Node Info</span>
                <button
                    style={CLOSE_BUTTON_STYLE}
                    onClick={closePopup}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(180, 190, 210, 0.7)')}
                    title="Close (ESC)"
                >
                    ×
                </button>
            </div>

            <div style={CONTENT_STYLE}>
                <div style={LABEL_STYLE}>{nodeLabel}</div>
                <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                    exercitation ullamco laboris.
                </p>
            </div>

            {/* Footer placeholder for chat input (Run 3) */}
            <div style={{ fontSize: '12px', opacity: 0.5, paddingTop: '12px', borderTop: '1px solid rgba(99, 171, 255, 0.2)' }}>
                Chat input will go here...
            </div>
        </div>
    );
};
