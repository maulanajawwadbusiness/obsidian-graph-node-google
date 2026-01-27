import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFullChat } from './FullChatStore';
import { usePopup } from '../popup/PopupStore';
import type { PhysicsEngine } from '../physics/engine';

/**
 * FullChatbar - Right-docked reasoning panel
 * Dark Elegance: deep navy base, intelligent blue energy accents,
 * spacious minimalism, calm analyst room for 20-hour thinking.
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
};

// =============================================================================
// DARK ELEGANCE DESIGN TOKENS
// Matches the canonical Node Popup identity: deep navy, intelligent blue energy
// =============================================================================
const TOKENS = {
    // Navy family (not ash/gray) — matches NodePopup rgba(20, 20, 30, 0.95)
    bgPanel: 'rgba(20, 20, 30, 0.98)',
    bgSurface: 'rgba(26, 26, 38, 0.95)',
    bgInput: 'rgba(32, 32, 46, 0.9)',
    bgUserMessage: 'rgba(38, 40, 54, 0.95)',

    // Borders — subtle navy separation
    borderSubtle: 'rgba(50, 52, 70, 0.5)',
    borderAccent: 'rgba(99, 171, 255, 0.2)',

    // Text — clean white/soft-white hierarchy
    textPrimary: 'rgba(220, 225, 235, 0.95)',
    textSecondary: 'rgba(180, 190, 210, 0.85)',
    textMuted: 'rgba(130, 140, 160, 0.7)',

    // Blue energy — use sparingly, where meaning is highest
    accentBlue: 'rgba(99, 171, 255, 0.9)',
    accentBlueMuted: 'rgba(99, 171, 255, 0.6)',

    // Spacing — generous breathing room
    spacingXs: '4px',
    spacingSm: '8px',
    spacingMd: '12px',
    spacingLg: '16px',
    spacingXl: '20px',
    spacing2xl: '24px',

    // Radii
    radiusSm: '4px',
    radiusMd: '6px',
    radiusLg: '8px',

    // Typography
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSizeXs: '11px',
    fontSizeSm: '12px',
    fontSizeMd: '14px',
    fontSizeLg: '16px',
    lineHeight: '1.6',
};

// =============================================================================
// STYLES — Dark Elegance, Spacious Minimalism
// =============================================================================

const PANEL_STYLE: React.CSSProperties = {
    // Exactly 30% width as required
    flex: '0 0 30%',
    minWidth: '320px',
    maxWidth: '480px',
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
    // NO transitions in v1
};

const HEADER_STYLE: React.CSSProperties = {
    height: '56px',
    padding: `0 ${TOKENS.spacingXl}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    // No border — clean navy separation via background
    flexShrink: 0,
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: TOKENS.fontSizeMd,
    fontWeight: 400,
    letterSpacing: '0.2px',
    // Blue accent on title — the "essence beam"
    color: TOKENS.accentBlue,
    opacity: 0.9,
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
    fontSize: '18px',
    lineHeight: 1,
};

const CONTEXT_BADGE_STYLE: React.CSSProperties = {
    padding: `${TOKENS.spacingMd} ${TOKENS.spacingXl}`,
    backgroundColor: TOKENS.bgSurface,
    borderBottom: `1px solid ${TOKENS.borderSubtle}`,
    fontSize: TOKENS.fontSizeXs,
    display: 'flex',
    alignItems: 'center',
    gap: TOKENS.spacingSm,
};

const MESSAGES_CONTAINER_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: TOKENS.spacing2xl,
    fontSize: TOKENS.fontSizeMd,
    lineHeight: TOKENS.lineHeight,
    padding: TOKENS.spacing2xl,
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
};

const MESSAGE_STYLE_AI: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: `${TOKENS.spacingSm} 0`,
    maxWidth: '90%',
    color: TOKENS.textSecondary,
    fontSize: TOKENS.fontSizeMd,
    lineHeight: TOKENS.lineHeight,
};

const INPUT_CONTAINER_STYLE: React.CSSProperties = {
    padding: TOKENS.spacingXl,
    borderTop: `1px solid ${TOKENS.borderSubtle}`,
    display: 'flex',
    gap: TOKENS.spacingMd,
    alignItems: 'flex-end',
    backgroundColor: TOKENS.bgSurface,
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
    overflow: 'hidden', // No scrollbar ever
    fontFamily: TOKENS.fontFamily,
    lineHeight: TOKENS.lineHeight,
};

const SEND_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderRadius: TOKENS.radiusSm,
    padding: TOKENS.spacingSm,
    // Blue accent for primary action
    color: TOKENS.accentBlueMuted,
    cursor: 'pointer',
    fontSize: '20px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
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
    gap: TOKENS.spacingLg,
};

const EMPTY_ICON_STYLE: React.CSSProperties = {
    width: '40px',
    height: '40px',
    // Blue accent for empty state icon
    color: TOKENS.accentBlueMuted,
    opacity: 0.4,
    marginBottom: TOKENS.spacingSm,
};

// =============================================================================
// AUTO-EXPANDING TEXTAREA LOGIC
// Grows with content up to 5 lines, no internal scrollbar
// =============================================================================
const LINE_HEIGHT_PX = 22; // approx line height at 14px font with 1.6 line-height
const MAX_LINES = 5;
const MIN_HEIGHT = 44; // single line with padding
const MAX_HEIGHT = MIN_HEIGHT + (LINE_HEIGHT_PX * (MAX_LINES - 1));

// =============================================================================
// COMPONENT
// =============================================================================

export const FullChatbar: React.FC<FullChatbarProps> = ({ engineRef }) => {
    const fullChat = useFullChat();
    const popupContext = usePopup();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Only show Active Context (current popup), not "Last Selected"
    const currentFocusNodeId = popupContext.isOpen ? popupContext.selectedNodeId : null;

    const getNodeLabel = (nodeId: string | null): string | null => {
        if (!nodeId || !engineRef.current) return null;
        return engineRef.current.nodes.get(nodeId)?.label ?? null;
    };

    const focusLabel = getNodeLabel(currentFocusNodeId);

    // Handle pending context from mini chat handoff
    useEffect(() => {
        if (fullChat.pendingContext && textareaRef.current) {
            setInputText(fullChat.pendingContext.suggestedPrompt);
            textareaRef.current.focus();
            fullChat.clearPendingContext();
        }
    }, [fullChat.pendingContext, fullChat.clearPendingContext]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [fullChat.messages]);

    // Auto-expand textarea height
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset to min to get accurate scrollHeight
        textarea.style.height = `${MIN_HEIGHT}px`;

        // Calculate new height (clamped to max)
        const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
        textarea.style.height = `${newHeight}px`;

        // Never show scrollbar — if at max, just stop growing
        textarea.style.overflowY = 'hidden';
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [inputText, adjustTextareaHeight]);

    const handleSend = () => {
        if (inputText.trim()) {
            fullChat.sendMessage(inputText.trim());
            setInputText('');
            // Reset height after send
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
        // Shift+Enter allows newline (default textarea behavior)
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
            {/* Header — blue title accent */}
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
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = TOKENS.textMuted;
                    }}
                >
                    ×
                </button>
            </div>

            {/* Context Badge — only Active Context (popup open), no "Last Selected" */}
            {focusLabel && (
                <div style={CONTEXT_BADGE_STYLE}>
                    <span style={{
                        color: TOKENS.accentBlue,
                        fontSize: TOKENS.fontSizeXs,
                        fontWeight: 500,
                    }}>
                        ●
                    </span>
                    <span style={{
                        color: TOKENS.textSecondary,
                        fontSize: TOKENS.fontSizeSm,
                    }}>
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
                    {/* Quiet geometric icon with blue accent */}
                    <svg
                        style={EMPTY_ICON_STYLE}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4l2 2" />
                    </svg>
                    <div style={{
                        color: TOKENS.textSecondary,
                        fontSize: TOKENS.fontSizeMd,
                        fontWeight: 400,
                    }}>
                        {focusLabel
                            ? `Thinking about ${focusLabel}`
                            : 'A quiet space for reasoning'
                        }
                    </div>
                    <div style={{
                        color: TOKENS.textMuted,
                        fontSize: TOKENS.fontSizeSm,
                        maxWidth: '240px',
                        lineHeight: '1.5',
                    }}>
                        {focusLabel
                            ? 'Trace your thoughts here.'
                            : 'Select a node for context, or begin directly.'
                        }
                    </div>
                </div>
            )}

            {/* Input Area — premium auto-expanding, no scrollbar */}
            <div style={INPUT_CONTAINER_STYLE}>
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Trace the thought here…"
                    style={{
                        ...INPUT_FIELD_STYLE,
                        height: `${MIN_HEIGHT}px`, // Initial, adjusted by effect
                    }}
                    rows={1}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = TOKENS.borderAccent;
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
                        opacity: inputText.trim() ? 1 : 0.4,
                        cursor: inputText.trim() ? 'pointer' : 'default',
                        color: inputText.trim() ? TOKENS.accentBlue : TOKENS.textMuted,
                    }}
                    aria-label="Send"
                    title="Send (Enter)"
                    onMouseEnter={(e) => {
                        if (inputText.trim()) {
                            e.currentTarget.style.color = TOKENS.textPrimary;
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = inputText.trim() ? TOKENS.accentBlue : TOKENS.textMuted;
                    }}
                >
                    {/* Minimal upward arrow — like NodePopup send button */}
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
