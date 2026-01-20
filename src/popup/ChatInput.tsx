import React, { useState, useRef, useEffect } from 'react';

/**
 * ChatInput - Expandable text input for popup footer
 * Expands up to 5 lines, image send button
 * 
 * TODO: Smooth expand animation - Currently expands suddenly on type.
 * Future improvement: Add CSS transition for height changes.
 */

import sendIcon from '../assets/send_icon.png';

interface ChatInputProps {
    placeholder?: string;
    onSend: (text: string) => void;
}

const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
    paddingTop: '12px',
    borderTop: '1px solid rgba(99, 171, 255, 0.2)',
};

const TEXTAREA_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: '24px', // 1 line (was 36px for 3 lines)
    maxHeight: '120px', // 5 lines * ~24px
    padding: '8px 12px',
    fontSize: '14px',
    lineHeight: '24px',
    color: 'rgba(180, 190, 210, 0.9)',
    backgroundColor: 'rgba(99, 171, 255, 0.05)',
    border: '1px solid rgba(99, 171, 255, 0.2)',
    borderRadius: '12px', // Increased from 6px
    fontFamily: 'system-ui, -apple-system, sans-serif',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s, background-color 0.2s',
};

const SEND_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    minWidth: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s, transform 0.2s',
    opacity: 0.6,
};

export const ChatInput: React.FC<ChatInputProps> = ({
    placeholder = 'Ask about this node...',
    onSend
}) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [text]);

    const handleSend = () => {
        if (text.trim()) {
            onSend(text.trim());
            setText('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={CONTAINER_STYLE}>
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                style={TEXTAREA_STYLE}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 171, 255, 0.5)';
                    e.currentTarget.style.backgroundColor = 'rgba(99, 171, 255, 0.08)';
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 171, 255, 0.2)';
                    e.currentTarget.style.backgroundColor = 'rgba(99, 171, 255, 0.05)';
                }}
            />
            <button
                style={SEND_BUTTON_STYLE}
                onClick={handleSend}
                disabled={!text.trim()}
                onMouseEnter={(e) => {
                    if (text.trim()) {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Send (Enter)"
            >
                <img src={sendIcon} alt="Send" style={{ width: '20px', height: '20px' }} />
            </button>
        </div>
    );
};
