import React from 'react';
import { useFullChat } from './FullChatStore';
import chatbarIcon from '../assets/chatbar_icon.png';
import chatbarIconMobile from '../assets/chatbar_icon_mobile.png';
import { FULLCHAT_ENABLED } from './fullChatFlags';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * Simple transparent button, no hover states, no glow
 */

const TOGGLE_STYLE: React.CSSProperties = {
    position: 'fixed',
    bottom: '30px',
    right: '30px',
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
    width: '64px',
    height: '64px',
    opacity: 0.7,
    transition: 'opacity 200ms ease',
};

const ICON_STYLE_HOVER: React.CSSProperties = {
    opacity: 1,
};

export const FullChatToggle: React.FC = () => {
    if (!FULLCHAT_ENABLED) return null;

    const { isOpen } = useFullChat();
    const [isHovered, setIsHovered] = React.useState(false);

    // Mobile detection: < 768px is standard mobile breakpoint
    const [isMobile, setIsMobile] = React.useState(
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isOpen) return null;

    const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

    return (
        <button
            type="button"
            style={TOGGLE_STYLE}
            onClick={undefined}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            aria-label={undefined}
            title={undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <img
                src={isMobile ? chatbarIconMobile : chatbarIcon}
                alt=""
                style={{
                    ...ICON_STYLE,
                    ...(isHovered ? ICON_STYLE_HOVER : {}),
                }}
            />
        </button>
    );
};
