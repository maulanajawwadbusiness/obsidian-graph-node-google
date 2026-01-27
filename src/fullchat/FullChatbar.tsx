import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFullChat } from './FullChatStore';
import { usePopup } from '../popup/PopupStore';
import type { PhysicsEngine } from '../physics/engine';

/**
 * FullChatbar - Right-docked reasoning panel
 * 
 * DARK ELEGANCE:
 * - Near-black void as base (not gray, not navy — BLACK)
 * - Blue is rare energy escaping from depth
 * - Mesmerizing, restrained, beautiful in its darkness
 */

interface FullChatbarProps {
    engineRef: React.RefObject<PhysicsEngine>;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const stopWheel = (e: React.WheelEvent) => e.stopPropagation();

// =============================================================================
// DARK ELEGANCE TOKENS — The Void with Energy Leaking Through
// =============================================================================
const VOID = {
    // The abyss — near black, deep, mesmerizing
    deepest: '#08080c',
    deep: '#0c0c12',
    surface: '#101016',
    elevated: '#14141c',

    // Text — soft glow against the void
    textBright: 'rgba(255, 255, 255, 0.92)',
    textSoft: 'rgba(200, 210, 225, 0.7)',
    textDim: 'rgba(140, 150, 170, 0.5)',

    // The energy that escapes — use SPARINGLY
    energy: '#56C4FF',
    energyGlow: 'rgba(86, 196, 255, 0.8)',
    energySubtle: 'rgba(86, 196, 255, 0.15)',
    energyFaint: 'rgba(86, 196, 255, 0.06)',

    // Borders — barely visible lines in the dark
    line: 'rgba(255, 255, 255, 0.04)',
    lineEnergy: 'rgba(86, 196, 255, 0.12)',
};

// =============================================================================
// STYLES — Depth and Darkness
// =============================================================================

const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 30%',
    minWidth: '320px',
    maxWidth: '480px',
    height: '100%',
    // The void — gradient creates depth
    background: `linear-gradient(180deg, ${VOID.deep} 0%, ${VOID.deepest} 100%)`,
    // Faint energy line on the left edge — light escaping
    borderLeft: `1px solid ${VOID.lineEnergy}`,
    boxShadow: `inset 1px 0 20px ${VOID.energyFaint}`,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: VOID.textSoft,
    position: 'relative',
    pointerEvents: 'auto',
};

const HEADER_STYLE: React.CSSProperties = {
    height: '56px',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${VOID.line}`,
    flexShrink: 0,
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    // The energy leaking through — this is THE accent
    color: VOID.energyGlow,
    textShadow: `0 0 20px ${VOID.energySubtle}`,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: VOID.textDim,
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    borderRadius: '4px',
};

const CONTEXT_BADGE_STYLE: React.CSSProperties = {
    padding: '12px 24px',
    background: VOID.surface,
    borderBottom: `1px solid ${VOID.line}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const MESSAGES_CONTAINER_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    fontSize: '14px',
    lineHeight: '1.65',
    padding: '24px',
};

const MESSAGE_STYLE_USER: React.CSSProperties = {
    alignSelf: 'flex-end',
    // Elevated surface — slightly visible against void
    background: VOID.elevated,
    padding: '14px 18px',
    borderRadius: '8px',
    maxWidth: '85%',
    color: VOID.textBright,
    fontSize: '14px',
    lineHeight: '1.6',
    // Subtle inner glow
    boxShadow: `inset 0 1px 0 ${VOID.line}`,
};

const MESSAGE_STYLE_AI: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: '8px 0',
    maxWidth: '90%',
    color: VOID.textSoft,
    fontSize: '14px',
    lineHeight: '1.65',
};

const INPUT_CONTAINER_STYLE: React.CSSProperties = {
    padding: '20px 24px',
    borderTop: `1px solid ${VOID.line}`,
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    background: VOID.surface,
};

const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '14px 18px',
    fontSize: '14px',
    background: VOID.deep,
    border: `1px solid ${VOID.line}`,
    borderRadius: '8px',
    color: VOID.textBright,
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    fontFamily: 'inherit',
    lineHeight: '1.5',
};

const SEND_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    flexShrink: 0,
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    textAlign: 'center',
    gap: '16px',
};

// Auto-expand constants
const MIN_HEIGHT = 48;
const MAX_HEIGHT = 140;

// =============================================================================
// COMPONENT
// =============================================================================

export const FullChatbar: React.FC<FullChatbarProps> = ({ engineRef }) => {
    const fullChat = useFullChat();
    const popupContext = usePopup();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const currentFocusNodeId = popupContext.isOpen ? popupContext.selectedNodeId : null;

    const getNodeLabel = (nodeId: string | null): string | null => {
        if (!nodeId || !engineRef.current) return null;
        return engineRef.current.nodes.get(nodeId)?.label ?? null;
    };

    const focusLabel = getNodeLabel(currentFocusNodeId);

    useEffect(() => {
        if (fullChat.pendingContext && textareaRef.current) {
            setInputText(fullChat.pendingContext.suggestedPrompt);
            textareaRef.current.focus();
            fullChat.clearPendingContext();
        }
    }, [fullChat.pendingContext, fullChat.clearPendingContext]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [fullChat.messages]);

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = `${MIN_HEIGHT}px`;
        const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
        textarea.style.height = `${newHeight}px`;
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [inputText, adjustTextareaHeight]);

    const handleSend = () => {
        if (inputText.trim()) {
            fullChat.sendMessage(inputText.trim());
            setInputText('');
            if (textareaRef.current) {
                textareaRef.current.style.height = `${MIN_HEIGHT}px`;
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!fullChat.isOpen) return null;

    const hasMessages = fullChat.messages.length > 0;

    return (
        <div
            style={{ ...PANEL_STYLE, touchAction: 'pan-x pan-y' }}
            onPointerDownCapture={stop}
            onPointerMoveCapture={stop}
            onPointerUpCapture={stop}
            onPointerCancelCapture={stop}
            onWheelCapture={stopWheel}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            {/* Header */}
            <div style={HEADER_STYLE}>
                <div style={TITLE_STYLE}>Reasoning</div>
                <button
                    type="button"
                    style={CLOSE_BUTTON_STYLE}
                    onClick={fullChat.closeFullChat}
                    aria-label="Close"
                    title="Close"
                    onMouseEnter={(e) => e.currentTarget.style.color = VOID.textSoft}
                    onMouseLeave={(e) => e.currentTarget.style.color = VOID.textDim}
                >
                    ×
                </button>
            </div>

            {/* Context — only when popup is open */}
            {focusLabel && (
                <div style={CONTEXT_BADGE_STYLE}>
                    {/* Energy dot — the only blue accent here */}
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: VOID.energy,
                        boxShadow: `0 0 8px ${VOID.energyGlow}`,
                    }} />
                    <span style={{ color: VOID.textSoft, fontSize: '13px' }}>
                        {focusLabel}
                    </span>
                </div>
            )}

            {/* Messages or Empty State */}
            {hasMessages ? (
                <div style={MESSAGES_CONTAINER_STYLE} className="arnvoid-scroll">
                    {fullChat.messages.map((msg, i) => (
                        <div
                            key={i}
                            style={msg.role === 'user' ? MESSAGE_STYLE_USER : MESSAGE_STYLE_AI}
                        >
                            {msg.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            ) : (
                <div style={EMPTY_STATE_STYLE}>
                    {/* Minimal — just a faint ring with energy glow */}
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: `1px solid ${VOID.energySubtle}`,
                        boxShadow: `0 0 30px ${VOID.energyFaint}, inset 0 0 20px ${VOID.energyFaint}`,
                        marginBottom: '8px',
                    }} />
                    <div style={{
                        color: VOID.textSoft,
                        fontSize: '14px',
                    }}>
                        {focusLabel ? `Thinking about ${focusLabel}` : 'A quiet space for reasoning'}
                    </div>
                    <div style={{
                        color: VOID.textDim,
                        fontSize: '12px',
                        maxWidth: '220px',
                    }}>
                        {focusLabel ? 'Trace your thoughts here.' : 'Select a node, or begin directly.'}
                    </div>
                </div>
            )}

            {/* Input */}
            <div style={INPUT_CONTAINER_STYLE}>
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Trace the thought here…"
                    style={{ ...INPUT_FIELD_STYLE, height: `${MIN_HEIGHT}px` }}
                    rows={1}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = VOID.lineEnergy;
                        e.currentTarget.style.boxShadow = `0 0 0 1px ${VOID.energyFaint}`;
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = VOID.line;
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    style={{
                        ...SEND_BUTTON_STYLE,
                        opacity: inputText.trim() ? 1 : 0.3,
                        cursor: inputText.trim() ? 'pointer' : 'default',
                    }}
                    aria-label="Send"
                    title="Send"
                    onMouseEnter={(e) => {
                        if (inputText.trim()) {
                            e.currentTarget.style.background = VOID.energyFaint;
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    {/* Energy arrow — the send action glows */}
                    <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill={inputText.trim() ? VOID.energy : VOID.textDim}
                        style={{
                            filter: inputText.trim() ? `drop-shadow(0 0 6px ${VOID.energySubtle})` : 'none',
                        }}
                    >
                        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
