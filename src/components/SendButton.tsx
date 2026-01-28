import React from 'react';
import sendIcon from '../assets/send_icon.png';

/**
 * SendButton - Reusable send button component
 * 
 * Canonical implementation sourced from Node Popup ChatInput.
 * All send buttons across the app should use this component for consistency.
 * 
 * Specifications:
 * - Icon: send_icon.png
 * - Idle opacity: 0.6
 * - Hover opacity: 0.9
 * - Hover scale: 1.1x
 * - Transition: 0.2s (200ms)
 * 
 * Size Control:
 * - Adjust SIZE_MULTIPLIER to scale the button globally (1.0 = original, 1.5 = 50% larger)
 */

interface SendButtonProps {
    onClick: () => void;
    disabled?: boolean;
}

// Size control knob - change this to scale the button size
const SIZE_MULTIPLIER = 1.3;

const BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    minWidth: `${32 * SIZE_MULTIPLIER}px`,
    height: `${32 * SIZE_MULTIPLIER}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.2s',
    opacity: 0.6,
};

const ICON_STYLE: React.CSSProperties = {
    width: `${20 * SIZE_MULTIPLIER}px`,
    height: `${20 * SIZE_MULTIPLIER}px`,
};

export const SendButton: React.FC<SendButtonProps> = ({ onClick, disabled = false }) => {
    return (
        <button
            style={BUTTON_STYLE}
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'scale(1.1)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Send (Enter)"
            aria-label="Send"
        >
            <img src={sendIcon} alt="" style={ICON_STYLE} />
        </button>
    );
};
