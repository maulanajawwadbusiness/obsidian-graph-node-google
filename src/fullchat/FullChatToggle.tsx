import React from 'react';
import { useFullChat } from './FullChatStore';
import chatbarIcon from '../assets/chatbar_icon.png';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * Simple transparent button, no hover states, no glow
 */

const TOGGLE_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 100,
    width: '72px',
    height: '72px',
    padding: 0,
    borderRadius: '16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const ICON_STYLE: React.CSSProperties = {
    width: '32px',
    height: '32px',
    opacity: 0.5,
    transition: 'opacity 200ms ease',
};

const ICON_STYLE_HOVER: React.CSSProperties = {
    opacity: 0.8,
};

export const FullChatToggle: React.FC = () => {
    const { isOpen, openFullChat } = useFullChat();
    const [isHovered, setIsHovered] = React.useState(false);

    if (isOpen) return null;

    return (
        <button
            type="button"
            style={TOGGLE_STYLE}
            onClick={openFullChat}
            aria-label="Open Chat"
            title="Open Chat"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <img
                src={chatbarIcon}
                alt=""
                style={{
                    ...ICON_STYLE,
                    ...(isHovered ? ICON_STYLE_HOVER : {}),
                }}
            />
        </button>
    );
};
