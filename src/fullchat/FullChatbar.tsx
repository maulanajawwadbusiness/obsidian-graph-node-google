import React, { useState, useRef, useEffect } from 'react';
import { useFullChat } from './FullChatStore';
import { usePopup } from '../popup/PopupStore';
import type { PhysicsEngine } from '../physics/engine';

/**
 * FullChatbar - Right-docked chat panel
 * The main place to process confusion, unknowing, and insight about the node map.
 * Feels inevitable, calm, and obvious.
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

const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 30%',
    height: '100%',
    backgroundColor: 'rgba(15, 15, 26, 0.98)',
    borderLeft: '1px solid rgba(99, 171, 255, 0.2)',
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'rgba(180, 190, 210, 0.9)',
    position: 'relative',
    pointerEvents: 'auto',
    // NO transitions in v1 — instant appearance
};

const HEADER_STYLE: React.CSSProperties = {
    height: '54px',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(99, 171, 255, 0.15)',
    flexShrink: 0,
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    letterSpacing: '0.2px',
    opacity: 0.85,
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(180, 190, 210, 0.8)',
    cursor: 'pointer',
    borderRadius: '8px',
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
};

const CONTEXT_BADGE_STYLE: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: 'rgba(99, 171, 255, 0.08)',
    borderBottom: '1px solid rgba(99, 171, 255, 0.1)',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
    padding: '16px',
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
    padding: '8px 0',
    maxWidth: '80%',
    color: 'rgba(180, 190, 210, 0.7)',
};

const INPUT_CONTAINER_STYLE: React.CSSProperties = {
    padding: '16px',
    borderTop: '1px solid rgba(99, 171, 255, 0.1)',
    display: 'flex',
    gap: '8px',
};

const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '10px 14px',
    fontSize: '13px',
    backgroundColor: 'rgba(99, 171, 255, 0.05)',
    border: 'none',
    borderRadius: '8px',
    color: 'rgba(180, 190, 210, 0.9)',
    outline: 'none',
    resize: 'none',
    minHeight: '40px',
    maxHeight: '120px',
    fontFamily: 'inherit',
};

const SEND_BUTTON_STYLE: React.CSSProperties = {
    background: 'rgba(99, 171, 255, 0.15)',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    color: 'rgba(180, 190, 210, 0.9)',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    textAlign: 'center',
    color: 'rgba(180, 190, 210, 0.5)',
    fontSize: '14px',
    gap: '12px',
};

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
    const contextType = focusLabel ? 'Current focus' : lastClickedLabel ? 'Last clicked' : null;

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
            {/* Header */}
            <div style={HEADER_STYLE}>
                <div style={TITLE_STYLE}>Full Chat</div>
                <button
                    type="button"
                    style={CLOSE_BUTTON_STYLE}
                    onClick={fullChat.closeFullChat}
                    aria-label="Close chat"
                    title="Close"
                >
                    ×
                </button>
            </div>

            {/* Context Badge */}
            {contextLabel && (
                <div style={CONTEXT_BADGE_STYLE}>
                    <div style={{ opacity: 0.6, fontSize: '11px' }}>{contextType}</div>
                    <div style={{ fontWeight: 500 }}>{contextLabel}</div>
                </div>
            )}

            {/* Messages or Empty State */}
            {hasMessages ? (
                <div style={MESSAGES_STYLE} className="arnvoid-scroll">
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
                    <div style={{ fontSize: '24px', opacity: 0.3 }}>💬</div>
                    {!contextLabel ? (
                        <>
                            <div>Click a node to focus, or just start chatting</div>
                            <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                This is your space to process confusion and gain insight
                            </div>
                        </>
                    ) : (
                        <>
                            <div>Ready to explore "{contextLabel}"</div>
                            <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                Ask anything about this node
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div style={INPUT_CONTAINER_STYLE}>
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                    style={INPUT_FIELD_STYLE}
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    style={{
                        ...SEND_BUTTON_STYLE,
                        opacity: inputText.trim() ? 1 : 0.5,
                        cursor: inputText.trim() ? 'pointer' : 'default',
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
};
