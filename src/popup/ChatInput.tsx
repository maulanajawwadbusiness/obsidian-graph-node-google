import React, { useState, useRef, useEffect } from 'react';
import { SendButton } from '../components/SendButton';

/**
 * ChatInput - Expandable text input for popup footer
 * Expands up to 5 lines, uses reusable SendButton component
 * 
 * TODO: Smooth expand animation - Currently expands suddenly on type.
 * Future improvement: Add CSS transition for height changes.
 */

interface ChatInputProps {
    placeholder?: string;
    onSend: (text: string) => void;
}

const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
    paddingTop: '16px',
    marginTop: '4px',
};

const TEXTAREA_STYLE: React.CSSProperties = {
    flex: 1,
    boxSizing: 'border-box',
    height: '40px',
    minHeight: '40px',
    maxHeight: '120px',
    padding: '8px 12px',
    fontSize: '14px',
    lineHeight: '24px',
    color: 'rgba(180, 190, 210, 0.9)',
    backgroundColor: 'rgba(99, 171, 255, 0.05)',
    border: 'none',
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    resize: 'none',
    overflow: 'hidden',
    overflowY: 'hidden',
    overflowX: 'hidden',
    outline: 'none',
    transition: 'height 150ms ease-out, border-color 0.2s, background-color 0.2s',
};

export const ChatInput: React.FC<ChatInputProps> = ({
    placeholder = 'Trace it further...',
    onSend
}) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea with smooth animation
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.overflowY = 'hidden';

        // Skip auto-sizing for empty text — maintain fixed 1-line height
        if (!text.trim()) {
            textarea.style.height = '40px';
            return;
        }

        // Only auto-size when there's actual content
        const currentHeight = textarea.offsetHeight;

        // Measure content height (set auto temporarily)
        textarea.style.height = 'auto';
        const targetHeight = Math.min(textarea.scrollHeight, 120);

        // Restore current height immediately (same frame, no repaint)
        textarea.style.height = `${currentHeight}px`;

        // Animate to target (next frame)
        requestAnimationFrame(() => {
            textarea.style.height = `${targetHeight}px`;
        });
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
                rows={1}
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
            <SendButton onClick={handleSend} disabled={!text.trim()} />
        </div>
    );
};
