import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

/**
 * MiniChatbar - Small chat window next to popup
 * Positioned adjacent to popup (intelligent left/right placement)
 */

import sendIcon from '../assets/send_icon.png';
import { usePopup } from './PopupStore';
import type { PopupRect } from './popupTypes';

interface Message {
    role: 'user' | 'ai';
    text: string;
}

interface MiniChatbarProps {
    messages: Message[];
    onSend: (text: string) => void;
    onClose: () => void;
}

type ChatbarSize = { width: number; height: number };

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const CHATBAR_STYLE: React.CSSProperties = {
    position: 'fixed',
    width: '300px',
    height: '400px',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    border: 'none',
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
    paddingBottom: '12px',
    marginBottom: '4px',
};

const MESSAGES_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    paddingLeft: '4px',      // Visual balance
    paddingRight: 'var(--scrollbar-gutter, 12px)',    // Reserve lane for scrollbar
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
    paddingTop: '12px',
    marginTop: '4px',
};

const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    backgroundColor: 'rgba(99, 171, 255, 0.05)',
    border: 'none',
    borderRadius: '6px',
    color: 'rgba(180, 190, 210, 0.9)',
    outline: 'none',
};

function computeChatbarPosition(
    popupRect: PopupRect | null,
    chatbarSize: ChatbarSize | null
): React.CSSProperties {
    if (!popupRect) {
        // Fallback: screen edge
        return {
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
        };
    }

    const DEFAULT_CHATBAR_WIDTH = 300;
    const DEFAULT_CHATBAR_HEIGHT = 400;
    const CHATBAR_WIDTH = chatbarSize?.width ?? DEFAULT_CHATBAR_WIDTH;
    const CHATBAR_HEIGHT = chatbarSize?.height ?? DEFAULT_CHATBAR_HEIGHT;
    const GAP = 20;  // Breathing room between popup and chatbar
    const MARGIN = 10;  // Screen edge margin
    const viewport = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
    const popupRight = popupRect.left + popupRect.width;
    const popupBottom = popupRect.top + popupRect.height;

    // Step 1: Determine preference based on popup position
    const popupCenterX = popupRect.left + popupRect.width / 2;
    const preferRight = popupCenterX < viewport / 2;

    const tryRight = () => {
        const left = popupRight + GAP;
        if (left + CHATBAR_WIDTH > viewport - MARGIN) return null;
        const top = clamp(popupRect.top, MARGIN, viewportHeight - CHATBAR_HEIGHT - MARGIN);
        return { left, top };
    };

    const tryLeft = () => {
        const left = popupRect.left - CHATBAR_WIDTH - GAP;
        if (left < MARGIN) return null;
        const top = clamp(popupRect.top, MARGIN, viewportHeight - CHATBAR_HEIGHT - MARGIN);
        return { left, top };
    };

    const tryBelow = () => {
        const top = popupBottom + GAP;
        if (top + CHATBAR_HEIGHT > viewportHeight - MARGIN) return null;
        const left = clamp(popupRect.left, MARGIN, viewport - CHATBAR_WIDTH - MARGIN);
        return { left, top };
    };

    const tryAbove = () => {
        const top = popupRect.top - CHATBAR_HEIGHT - GAP;
        if (top < MARGIN) return null;
        const left = clamp(popupRect.left, MARGIN, viewport - CHATBAR_WIDTH - MARGIN);
        return { left, top };
    };

    const candidates = preferRight
        ? [tryRight, tryLeft, tryBelow, tryAbove]
        : [tryLeft, tryRight, tryBelow, tryAbove];

    for (const candidate of candidates) {
        const position = candidate();
        if (position) {
            return {
                left: `${position.left}px`,
                top: `${position.top}px`,
            };
        }
    }

    // Last resort: avoid overlap even if it means going offscreen
    const rightSpace = viewport - popupRight - MARGIN;
    const leftSpace = popupRect.left - MARGIN;
    const left = rightSpace >= leftSpace
        ? popupRight + GAP
        : popupRect.left - CHATBAR_WIDTH - GAP;
    const top = clamp(popupRect.top, MARGIN, Math.max(MARGIN, viewportHeight - CHATBAR_HEIGHT - MARGIN));

    return {
        left: `${left}px`,
        top: `${top}px`,
    };
}

export const MiniChatbar: React.FC<MiniChatbarProps> = ({ messages, onSend, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [inputText, setInputText] = useState('');
    const [chatbarSize, setChatbarSize] = useState<ChatbarSize | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);  // Scroll container ref
    const fadeWrapperRef = useRef<HTMLDivElement>(null);  // Fade wrapper ref
    const scrollTimeoutRef = useRef<number | null>(null);
    const chatbarRef = useRef<HTMLDivElement>(null);
    const { popupRect } = usePopup();

    // Animate in
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useLayoutEffect(() => {
        const measure = () => {
            if (!chatbarRef.current) return;
            const next = {
                width: chatbarRef.current.offsetWidth,
                height: chatbarRef.current.offsetHeight,
            };
            setChatbarSize((prev) => {
                if (prev && prev.width === next.width && prev.height === next.height) {
                    return prev;
                }
                return next;
            });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        // Re-evaluate fades when messages change
        const scroller = messagesRef.current;
        const wrapper = fadeWrapperRef.current;
        if (!scroller || !wrapper) return;

        requestAnimationFrame(() => {
            const { scrollTop, scrollHeight, clientHeight } = scroller;

            wrapper.classList.toggle('fade-top', scrollTop > 8);
            wrapper.classList.toggle('fade-bottom', scrollTop + clientHeight < scrollHeight - 8);
        });
    }, [messages]);

    // RAF-throttled scroll listener using classList + timeout to avoid React re-render on scroll
    useEffect(() => {
        const scroller = messagesRef.current;
        const wrapper = fadeWrapperRef.current;
        if (!scroller || !wrapper) return;

        let rafId = 0;

        const updateFades = () => {
            const { scrollTop, scrollHeight, clientHeight } = scroller;

            const hasTop = scrollTop > 8;
            const hasBottom = scrollTop + clientHeight < scrollHeight - 8;

            // Toggle classes directly on DOM — no React state update
            wrapper.classList.toggle('fade-top', hasTop);
            wrapper.classList.toggle('fade-bottom', hasBottom);
        };

        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updateFades);

            scroller.classList.add('is-scrolling');
            if (scrollTimeoutRef.current !== null) {
                window.clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = window.setTimeout(() => {
                scroller.classList.remove('is-scrolling');
            }, 420);
        };

        scroller.addEventListener('scroll', onScroll, { passive: true });

        // Initial evaluation
        updateFades();

        return () => {
            scroller.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(rafId);
            if (scrollTimeoutRef.current !== null) {
                window.clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

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

    const position = computeChatbarPosition(popupRect, chatbarSize);

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
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Mini Chat</span>
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

            <div
                ref={fadeWrapperRef}
                className="arnvoid-scroll-fades"
                style={{
                    position: 'relative',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '8px',  // Match chatbar inner rounding
                }}
            >
                <div
                    ref={messagesRef}
                    className="arnvoid-scroll"
                    style={MESSAGES_STYLE}
                >
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
