import React from 'react';
import { useFullChat } from './FullChatStore';
import chatbarIcon from '../assets/chatbar_icon.png';

/**
 * FullChatToggle - Bottom-right toggle button for Full Chatbar
 * 
 * All-out butter-smooth implementation:
 * - CSS-only hover (no React state = no re-render = no micro-jank)
 * - GPU-accelerated properties (transform, filter)
 * - will-change hints for compositor optimization
 * - Tight layered drop-shadows for genuine line glow
 */

// Generate style tag for pure CSS hover (no React state changes)
const STYLE_ID = 'fullchat-toggle-styles';

const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .fullchat-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 100;
            width: 72px;
            height: 72px;
            padding: 0;
            margin: 0;
            border-radius: 16px;
            background: transparent;
            border: none;
            outline: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-tap-highlight-color: transparent;
            /* GPU acceleration hints */
            will-change: transform;
            transform: translateZ(0);
            /* Butter-smooth transform transition */
            transition: transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        
        .fullchat-toggle:hover {
            transform: translateZ(0) scale(1.06);
        }
        
        .fullchat-toggle:active {
            transform: translateZ(0) scale(0.97);
            transition: transform 60ms cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        
        .fullchat-toggle-icon {
            width: 32px;
            height: 32px;
            pointer-events: none;
            /* GPU acceleration hints */
            will-change: filter;
            transform: translateZ(0);
            /* 
             * GENUINE LINE GLOW:
             * Tight layered drop-shadows that hug the lines
             * Layer 1: Tight inner glow (1px blur)
             * Layer 2: Medium halo (4px blur)  
             * Layer 3: Outer atmosphere (10px blur)
             */
            filter: 
                drop-shadow(0 0 0px rgba(86, 196, 255, 0))
                drop-shadow(0 0 0px rgba(86, 196, 255, 0))
                drop-shadow(0 0 0px rgba(86, 196, 255, 0));
            /* Butter-smooth filter transition */
            transition: filter 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        
        .fullchat-toggle:hover .fullchat-toggle-icon {
            filter: 
                drop-shadow(0 0 1px rgba(86, 196, 255, 0.22))
                drop-shadow(0 0 4px rgba(86, 196, 255, 0.17))
                drop-shadow(0 0 12px rgba(86, 196, 255, 0.8));
        }
        
        .fullchat-toggle:active .fullchat-toggle-icon {
            filter: 
                drop-shadow(0 0 2px rgba(86, 196, 255, 1))
                drop-shadow(0 0 6px rgba(86, 196, 255, 0.8))
                drop-shadow(0 0 16px rgba(86, 196, 255, 0.5));
        }
    `;
    document.head.appendChild(style);
};

export const FullChatToggle: React.FC = () => {
    const { isOpen, openFullChat } = useFullChat();

    // Inject CSS once
    React.useEffect(() => {
        injectStyles();
    }, []);

    if (isOpen) return null;

    return (
        <button
            type="button"
            className="fullchat-toggle"
            onClick={openFullChat}
            aria-label="Open Chat"
            title="Open Chat"
        >
            <img
                src={chatbarIcon}
                alt=""
                className="fullchat-toggle-icon"
                draggable={false}
            />
        </button>
    );
};
