import React, { useState, useRef, useEffect } from 'react';

/**
 * MiniChatbar - Small chat window next to popup
 * Shows conversation with mock AI replies
 */

import sendIcon from '../assets/send_icon.png';

interface Message {
    role: 'user' | 'ai';
    text: string;
}

interface MiniChatbarProps {
    messages: Message[];
    onSend: (text: string) => void;
    onClose: () => void;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const CHATBAR_STYLE: React.CSSProperties = {
    position: 'fixed',
    width: '300px',
    height: '400px',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid rgba(99, 171, 255, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    color: 'rgba(180, 190, 210, 0.9)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
    zIndex: 1002, // Above popup
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'opacity 200ms ease-out, transform 200ms ease-out',
    opacity: 0,
    transform: 'scale(0.95) translateY(10px)',
};

const CHATBAR_VISIBLE_STYLE: React.CSSProperties = {
    opacity: 1,
    transform: 'scale(1) translateY(0)',
};

const HEADER_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(99, 171, 255, 0.2)',
};

const MESSAGES_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
};

const MESSAGE_STYLE_USER: React.CSSProperties = {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(99, 171, 255, 0.15)',
    padding: '8px 12px',
    borderRadius: '8px 8px 2px 8px',
    maxWidth: '80%',
};

const MESSAGE_STYLE_AI: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: '8px 0', // No bubble, just padding for spacing
    maxWidth: '80%',
    color: 'rgba(180, 190, 210, 0.7)', // Slightly muted
};

const INPUT_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(99, 171, 255, 0.2)',
};

const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    backgroundColor: 'rgba(99, 171, 255, 0.05)',
    border: '1px solid rgba(99, 171, 255, 0.2)',
    borderRadius: '6px',
    color: 'rgba(180, 190, 210, 0.9)',
    outline: 'none',
};

export const MiniChatbar: React.FC<MiniChatbarProps> = ({ messages, onSend, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatbarRef = useRef<HTMLDivElement>(null);

    // Animate in
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Position adjacent to popup (right side of viewport)
    const position: React.CSSProperties = {
        right: '20px',
        top: '50%',
        transform: isVisible ? 'translateY(-50%)' : 'translateY(-50%) translateY(10px) scale(0.95)',
    };

    const handleSend = () => {
        if (inputText.trim()) {
            onSend(inputText.trim());
            setInputText('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    const finalStyle = {
        ...CHATBAR_STYLE,
        ...(isVisible ? CHATBAR_VISIBLE_STYLE : {}),
        ...position,
    };

    return (
        <div
            ref={chatbarRef}
            style={finalStyle}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={stopPropagation}
        >
            <div style={HEADER_STYLE}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Chat</span>
                <button
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(180, 190, 210, 0.7)',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                    }}
                    onClick={onClose}
                    title="Close"
                >
                    ×
                </button>
            </div>

            <div style={MESSAGES_STYLE}>
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        style={msg.role === 'user' ? MESSAGE_STYLE_USER : MESSAGE_STYLE_AI}
                    >
                        {msg.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={INPUT_STYLE}>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    style={INPUT_FIELD_STYLE}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s, transform 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (inputText.trim()) {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.6';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <img src={sendIcon} alt="Send" style={{ width: '18px', height: '18px' }} />
                </button>
            </div>
        </div>
    );
};
