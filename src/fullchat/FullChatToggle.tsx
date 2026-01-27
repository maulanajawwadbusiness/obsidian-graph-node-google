import React from 'react';
import { useFullChat } from './FullChatStore';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * Hidden when chatbar is open (chatbar has its own close button)
 */

const TOGGLE_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 100,
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(99, 171, 255, 0.15)',
    border: '1px solid rgba(99, 171, 255, 0.3)',
    color: 'rgba(180, 190, 210, 0.9)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(8px)',
    fontSize: '20px',
    // NO transitions in v1
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
            aria-label="Open Full Chat"
            title="Open Full Chat"
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 171, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 171, 255, 0.15)';
            }}
        >
            💬
        </button>
    );
};
