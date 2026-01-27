import React from 'react';
import { useFullChat } from './FullChatStore';
import chatbarIcon from '../assets/chatbar_icon.png';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * Dark elegance: energy button with subtle luminous gradient, no border.
 * Hidden when chatbar is open (chatbar has its own close button).
 */

// Arnvoid energy blue family (based on #56C4FF node tone)
const ENERGY_GRADIENT = 'linear-gradient(135deg, rgba(56, 160, 220, 0.85) 0%, rgba(86, 196, 255, 0.9) 50%, rgba(100, 180, 240, 0.8) 100%)';

const TOGGLE_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 100,
    // 2x larger visual weight — intentional, not tiny
    width: '56px',
    height: '56px',
    padding: 0,
    borderRadius: '12px',
    // Energy gradient — subtle luminous depth
    background: ENERGY_GRADIENT,
    // NO border — clean energy button
    border: 'none',
    // Soft glow shadow for luminous feel
    boxShadow: '0 4px 20px rgba(86, 196, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // NO transitions in v1
};

const ICON_STYLE: React.CSSProperties = {
    // Sized for line icon replacement later — clean, not cramped
    width: '24px',
    height: '24px',
    opacity: 1,
    // White icon on blue gradient
    filter: 'invert(1) brightness(1.1)',
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
                e.currentTarget.style.boxShadow = '0 6px 28px rgba(86, 196, 255, 0.4), 0 3px 12px rgba(0, 0, 0, 0.35)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(86, 196, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.3)';
            }}
        >
            <img src={chatbarIcon} alt="" style={ICON_STYLE} />
        </button>
    );
};
