import React, { useState, useRef, useEffect } from 'react';
import { useFullChat } from './FullChatStore';
import { usePopup } from '../popup/PopupStore';
import type { PhysicsEngine } from '../physics/engine';

/**
 * FullChatbar - Right-docked reasoning panel
 * A calm, professional space to process confusion, unknowing, and insight about the map.
 * Design language: dark elegance, quiet confidence, analyst-room aesthetic.
 */

interface FullChatbarProps {
    engineRef: React.RefObject<PhysicsEngine>;
}

// Safe stop — propagation only, never preventDefault
const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
};

// Safe wheel — stop canvas zoom, but allow chat scroll
const stopWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Do NOT preventDefault() — this preserves normal scroll inside chat
};

// =============================================================================
// DESIGN TOKENS — Arnvoid professional dark palette
// =============================================================================
const TOKENS = {
    // Colors
    bgPanel: 'rgba(15, 15, 22, 0.98)',
    bgSurface: 'rgba(22, 22, 32, 0.95)',
    bgInput: 'rgba(28, 28, 40, 0.9)',
    bgUserMessage: 'rgba(35, 38, 48, 0.95)',
    borderSubtle: 'rgba(60, 65, 80, 0.4)',
    borderAccent: 'rgba(99, 171, 255, 0.15)',
    textPrimary: 'rgba(200, 205, 215, 0.95)',
    textSecondary: 'rgba(160, 165, 180, 0.75)',
    textMuted: 'rgba(120, 125, 140, 0.6)',
    accentBlue: 'rgba(99, 171, 255, 0.8)',
    // Spacing
    spacingXs: '4px',
    spacingSm: '8px',
    spacingMd: '12px',
    spacingLg: '16px',
    spacingXl: '20px',
    spacing2xl: '24px',
    // Radii — consistent quiet rounded rectangles
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '8px',
    // Typography
    fontFamily: "'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif",
    fontSizeXs: '11px',
    fontSizeSm: '12px',
    fontSizeMd: '13px',
    fontSizeLg: '14px',
    lineHeight: '1.6',
};

// =============================================================================
// STYLES — Professional analyst-room aesthetic
// =============================================================================

const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 320px',
    minWidth: '280px',
    maxWidth: '400px',
    height: '100%',
    backgroundColor: TOKENS.bgPanel,
    borderLeft: `1px solid ${TOKENS.borderSubtle}`,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: TOKENS.fontFamily,
    color: TOKENS.textPrimary,
    position: 'relative',
    pointerEvents: 'auto',
    // NO transitions in v1 — instant appearance
};

const HEADER_STYLE: React.CSSProperties = {
    height: '48px',
    padding: `0 ${TOKENS.spacingLg}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${TOKENS.borderSubtle}`,
    flexShrink: 0,
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: TOKENS.fontSizeSm,
    fontWeight: 500,
    letterSpacing: '0.4px',
    textTransform: 'uppercase' as const,
    color: TOKENS.textMuted,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: TOKENS.textMuted,
    cursor: 'pointer',
    borderRadius: TOKENS.radiusSm,
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    lineHeight: 1,
};

const CONTEXT_BADGE_STYLE: React.CSSProperties = {
    padding: `${TOKENS.spacingMd} ${TOKENS.spacingLg}`,
    backgroundColor: TOKENS.bgSurface,
    borderBottom: `1px solid ${TOKENS.borderSubtle}`,
    fontSize: TOKENS.fontSizeXs,
    display: 'flex',
    flexDirection: 'column',
    gap: TOKENS.spacingXs,
};

const MESSAGES_CONTAINER_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: TOKENS.spacingXl,
    fontSize: TOKENS.fontSizeMd,
    lineHeight: TOKENS.lineHeight,
    padding: TOKENS.spacingXl,
    // Breathing room for long-form reading
};

const MESSAGE_STYLE_USER: React.CSSProperties = {
    alignSelf: 'flex-end',
    backgroundColor: TOKENS.bgUserMessage,
    padding: `${TOKENS.spacingMd} ${TOKENS.spacingLg}`,
    borderRadius: TOKENS.radiusMd,
    maxWidth: '85%',
    color: TOKENS.textPrimary,
    fontSize: TOKENS.fontSizeMd,
    lineHeight: TOKENS.lineHeight,
    // Clean rectangle, not pill bubble
};

const MESSAGE_STYLE_AI: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: `${TOKENS.spacingSm} 0`,
    maxWidth: '90%',
    color: TOKENS.textSecondary,
    fontSize: TOKENS.fontSizeMd,
    lineHeight: TOKENS.lineHeight,
    // Uncontained for natural reading flow
};

const INPUT_CONTAINER_STYLE: React.CSSProperties = {
    padding: TOKENS.spacingLg,
    borderTop: `1px solid ${TOKENS.borderSubtle}`,
    display: 'flex',
    gap: TOKENS.spacingMd,
    alignItems: 'flex-end',
};

const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: `${TOKENS.spacingMd} ${TOKENS.spacingLg}`,
    fontSize: TOKENS.fontSizeMd,
    backgroundColor: TOKENS.bgInput,
    border: `1px solid ${TOKENS.borderSubtle}`,
    borderRadius: TOKENS.radiusMd,
    color: TOKENS.textPrimary,
    outline: 'none',
    resize: 'none',
    minHeight: '40px',
    maxHeight: '140px',
    fontFamily: TOKENS.fontFamily,
    lineHeight: TOKENS.lineHeight,
};

const SEND_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderRadius: TOKENS.radiusSm,
    padding: TOKENS.spacingSm,
    color: TOKENS.textMuted,
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    flexShrink: 0,
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: TOKENS.spacing2xl,
    textAlign: 'center',
    gap: TOKENS.spacingMd,
};

const EMPTY_ICON_STYLE: React.CSSProperties = {
    width: '32px',
    height: '32px',
    opacity: 0.15,
    marginBottom: TOKENS.spacingSm,
};

// =============================================================================
// COMPONENT
// =============================================================================

export const FullChatbar: React.FC<FullChatbarProps> = ({ engineRef }) => {
    const fullChat = useFullChat();
    const popupContext = usePopup();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Deterministic focus context sourcing
    const currentFocusNodeId = popupContext.isOpen ? popupContext.selectedNodeId : null;
    const lastClickedNodeId = popupContext.lastClickedNodeId;

    const getNodeLabel = (nodeId: string | null): string | null => {
        if (!nodeId || !engineRef.current) return null;
        return engineRef.current.nodes.get(nodeId)?.label ?? null;
    };

    const focusLabel = getNodeLabel(currentFocusNodeId);
    const lastClickedLabel = getNodeLabel(lastClickedNodeId);

    // Determine which context to show
    const contextLabel = focusLabel || lastClickedLabel;
    const contextType = focusLabel ? 'Active context' : lastClickedLabel ? 'Last selected' : null;

    // Handle pending context from mini chat handoff
    useEffect(() => {
        if (fullChat.pendingContext && textareaRef.current) {
            setInputText(fullChat.pendingContext.suggestedPrompt);
            textareaRef.current.focus();
            // Clear pending context after applying
            fullChat.clearPendingContext();
        }
    }, [fullChat.pendingContext, fullChat.clearPendingContext]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [fullChat.messages]);

    const handleSend = () => {
        if (inputText.trim()) {
            fullChat.sendMessage(inputText.trim());
            setInputText('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter allows newline (default behavior for textarea)
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
            {/* Header — minimal, professional */}
            <div style={HEADER_STYLE}>
                <div style={TITLE_STYLE}>Reasoning</div>
                <button
                    type="button"
                    style={CLOSE_BUTTON_STYLE}
                    onClick={fullChat.closeFullChat}
                    aria-label="Close panel"
                    title="Close"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = TOKENS.textSecondary;
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = TOKENS.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    ×
                </button>
            </div>

            {/* Context Badge — quiet indicator */}
            {contextLabel && (
                <div style={CONTEXT_BADGE_STYLE}>
                    <div style={{ color: TOKENS.textMuted, fontSize: TOKENS.fontSizeXs, letterSpacing: '0.3px' }}>
                        {contextType}
                    </div>
                    <div style={{ fontWeight: 500, color: TOKENS.textSecondary, fontSize: TOKENS.fontSizeSm }}>
                        {contextLabel}
                    </div>
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
                    {/* Quiet geometric placeholder instead of emoji */}
                    <svg
                        style={EMPTY_ICON_STYLE}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    >
                        <rect x="3" y="3" width="18" height="14" rx="2" />
                        <line x1="7" y1="8" x2="17" y2="8" />
                        <line x1="7" y1="12" x2="13" y2="12" />
                    </svg>
                    {!contextLabel ? (
                        <>
                            <div style={{ color: TOKENS.textMuted, fontSize: TOKENS.fontSizeMd }}>
                                Quiet space for thinking.
                            </div>
                            <div style={{ color: TOKENS.textMuted, fontSize: TOKENS.fontSizeXs, opacity: 0.7, maxWidth: '200px' }}>
                                Select a node to set context, or begin reasoning directly.
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ color: TOKENS.textSecondary, fontSize: TOKENS.fontSizeMd }}>
                                Context: {contextLabel}
                            </div>
                            <div style={{ color: TOKENS.textMuted, fontSize: TOKENS.fontSizeXs, opacity: 0.7 }}>
                                Start a line of inquiry.
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Input Area — serious tool for reasoning */}
            <div style={INPUT_CONTAINER_STYLE}>
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="What needs clarification?"
                    style={INPUT_FIELD_STYLE}
                    rows={1}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(99, 171, 255, 0.35)';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = TOKENS.borderSubtle;
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    style={{
                        ...SEND_BUTTON_STYLE,
                        opacity: inputText.trim() ? 0.8 : 0.3,
                        cursor: inputText.trim() ? 'pointer' : 'default',
                    }}
                    aria-label="Send"
                    title="Send (Enter)"
                    onMouseEnter={(e) => {
                        if (inputText.trim()) {
                            e.currentTarget.style.color = TOKENS.accentBlue;
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = TOKENS.textMuted;
                    }}
                >
                    {/* Minimal line-based send icon */}
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
