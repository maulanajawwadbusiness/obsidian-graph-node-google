import React from 'react';
import { useFullChat } from './FullChatStore';
import chatbarIcon from '../assets/chatbar_icon.png';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * Matches the "Open Viewer" button style: rounded rectangle, 6px radius.
 * Hidden when chatbar is open (chatbar has its own close button).
 */

const TOGGLE_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 100,
    // Rounded rectangle matching Open Viewer button (6px radius)
    padding: '8px 14px',
    borderRadius: '6px',
    minWidth: '44px',
    minHeight: '36px',
    // Professional dark background
    backgroundColor: 'rgba(20, 20, 30, 0.85)',
    border: '1px solid rgba(99, 171, 255, 0.3)',
    color: 'rgba(180, 190, 210, 0.9)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backdropFilter: 'blur(8px)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    // NO transitions in v1
};

const ICON_STYLE: React.CSSProperties = {
    width: '18px',
    height: '18px',
    opacity: 0.9,
    // Invert to white for dark background
    filter: 'invert(1)',
};

export const FullChatToggle: React.FC = () => {
    const { isOpen, openFullChat } = useFullChat();

    // Hidden when chatbar is open
    if (isOpen) return null;

    return (
        <button
            type="button"
            style={TOGGLE_STYLE}
            onClick={openFullChat}
            aria-label="Open Chat"
            title="Open Chat"
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(30, 30, 42, 0.95)';
                e.currentTarget.style.borderColor = 'rgba(99, 171, 255, 0.45)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(20, 20, 30, 0.85)';
                e.currentTarget.style.borderColor = 'rgba(99, 171, 255, 0.3)';
            }}
        >
            <img src={chatbarIcon} alt="" style={ICON_STYLE} />
        </button>
    );
};
