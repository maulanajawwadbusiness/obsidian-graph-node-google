import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useFullChat } from './FullChatStore';
import { useStreamSimulator } from './useStreamSimulator';
import { usePopup } from '../popup/PopupStore';
import type { PhysicsEngine } from '../physics/engine';
import type { FullChatMessage } from './fullChatTypes';
import { SendButton } from '../components/SendButton';

/**
 * FullChatbar - Right-docked reasoning panel
 * 
 * SMOOTH CONVERSATION EXPERIENCE:
 * - Typing: calm, anchored, no jitter
 * - Sending: instant clear, smooth handoff
 * - Streaming: single growing bubble, thinking indicator
 * - Scrolling: breathing rhythm, maintained position
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
    // Input text — slightly softer, "ink about to be committed"
    textInput: 'rgba(255, 255, 255, 0.85)',

    // The energy that escapes — use SPARINGLY
    energy: '#56C4FF',
    energyGlow: 'rgba(86, 196, 255, 0.8)',
    energySubtle: 'rgba(86, 196, 255, 0.15)',
    energyFaint: 'rgba(86, 196, 255, 0.06)',

    // Borders — barely visible lines in the dark
    line: 'rgba(255, 255, 255, 0.04)',
    lineEnergy: 'rgba(86, 196, 255, 0.12)',
};

// Mock response for testing streaming
const MOCK_AI_RESPONSE = 'This is a mock AI response. In the future, this will be a real AI-powered reply based on the node and document context. The streaming simulation reveals text gradually to test the conversation flow experience.';

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
    // CSS variables for scroll fades
    '--panel-bg-rgb': '8, 8, 12',
    '--panel-bg-opacity': '1',
} as React.CSSProperties;

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

// Wrapper for scroll fades
const MESSAGES_WRAPPER_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
};

const MESSAGES_CONTAINER_STYLE: React.CSSProperties = {
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    fontSize: '14px',
    lineHeight: '1.65',
    padding: '24px',
    paddingRight: 'var(--scrollbar-gutter, 12px)',
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
    padding: '8px 14px',
    fontSize: '14px',
    background: VOID.deep,
    border: `1px solid ${VOID.line}`,
    borderRadius: '8px',
    color: VOID.textInput,  // Softer, "ink about to be committed"
    caretColor: VOID.energy,  // Energy-colored caret
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    fontFamily: 'inherit',
    lineHeight: '1.4',
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

const JUMP_TO_LATEST_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '12px',
    right: '24px',
    background: VOID.elevated,
    border: `1px solid ${VOID.lineEnergy}`,
    borderRadius: '16px',
    padding: '6px 14px',
    color: VOID.textSoft,
    fontSize: '11px',
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'opacity 150ms ease',
};

// Auto-expand: compact single-line default, grows to max 5 lines
const MIN_HEIGHT = 36;
const MAX_HEIGHT = 116;

// Threshold for "at bottom" detection (pixels from bottom)
const SCROLL_BOTTOM_THRESHOLD = 50;

// =============================================================================
// STREAMING DOTS — Subtle thinking indicator
// =============================================================================
const STREAMING_DOTS_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    gap: '3px',
    marginLeft: '4px',
    opacity: 0.35,
};

const DOT_STYLE: React.CSSProperties = {
    fontSize: '16px',
    lineHeight: 1,
};

const StreamingDots: React.FC = memo(() => (
    <span style={STREAMING_DOTS_STYLE}>
        <span style={DOT_STYLE}>·</span>
        <span style={DOT_STYLE}>·</span>
        <span style={DOT_STYLE}>·</span>
    </span>
));

// =============================================================================
// COMPONENT
// =============================================================================

export const FullChatbar: React.FC<FullChatbarProps> = ({ engineRef }) => {
    const fullChat = useFullChat();
    const popupContext = usePopup();
    const streamSimulator = useStreamSimulator();

    const [inputText, setInputText] = useState('');
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);

    // v4 Prefill Logic State (Deterministic Breath Streaming)
    const [dirtySincePrefill, setDirtySincePrefill] = useState(false);

    // Core state for v4 controller
    const currentRunIdRef = useRef<number | null>(null);
    const phaseRef = useRef<'idle' | 'seed' | 'breath' | 'refine'>('idle');
    const breathDoneRef = useRef(false);

    // Data holding (local, not state, to avoid re-renders)
    const seedTextRef = useRef<string>('');
    const refinedTextRef = useRef<string | null>(null);

    // Automation & Safety Refs
    const streamTokenRef = useRef<number>(0);
    const breathTimerRef = useRef<number | null>(null);
    const isProgrammaticSetRef = useRef<boolean>(false);
    const rafRef = useRef<number | null>(null);

    // Performance Counters
    const perfCountersRef = useRef({
        seedTicks: 0,
        maxTickMs: 0,
        maxResizeMs: 0,
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isSendingRef = useRef(false);  // Prevent double-send

    const currentFocusNodeId = popupContext.isOpen ? popupContext.selectedNodeId : null;

    const getNodeLabel = (nodeId: string | null): string | null => {
        if (!nodeId || !engineRef.current) return null;
        return engineRef.current.nodes.get(nodeId)?.label ?? null;
    };

    // --- Helper: Cancellation ---
    const cancelEverything = useCallback((reason: string) => {
        console.log(`[Prefill] cancel reason=${reason} runId=${currentRunIdRef.current}`);

        // 1. Stop streaming
        streamTokenRef.current++; // Invalidates current rAF
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        // 2. Stop breath timer
        if (breathTimerRef.current) {
            clearTimeout(breathTimerRef.current);
            breathTimerRef.current = null;
        }

        // 3. Reset phase
        phaseRef.current = 'idle';

        // 4. Sync state to ensure consistency (e.g. if we cancelled mid-stream, keep text)
        // If cancellation is due to user typing, handleInputChange already handled it.
        // If cancellation is due to new run, we typically clear anyway.
        // So explicit sync here is handled by specific triggers (new run clears, user type updates).
    }, []);

    // --- Helper: Ease Out Cubic ---
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // --- Helper: Deterministic Streaming ---
    const streamToText = useCallback((targetRunId: number, targetText: string, durationMs: number, onDone: () => void) => {
        // Setup new stream
        streamTokenRef.current++;
        const myToken = streamTokenRef.current;
        const startTime = performance.now();

        // Reset counters for seed phase (approximation)
        if (phaseRef.current === 'seed') {
            perfCountersRef.current = { seedTicks: 0, maxTickMs: 0, maxResizeMs: 0 };
        }

        let lastLen = 0; // optimization: only touch DOM if length changed

        const tick = () => {
            // Check invalidation
            if (myToken !== streamTokenRef.current || targetRunId !== currentRunIdRef.current) return;

            const tickStart = performance.now();
            perfCountersRef.current.seedTicks++;

            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = easeOutCubic(progress);

            // Calculate length
            const nextLen = Math.floor(eased * targetText.length);

            // DOM Access & Update
            if (nextLen !== lastLen) { // Only write if changed
                const nextVal = targetText.slice(0, nextLen);

                if (textareaRef.current) {
                    isProgrammaticSetRef.current = true;
                    textareaRef.current.value = nextVal;

                    // Layout Thrashing Fix:
                    // During 'seed' (short, predictable), we SKIP autosize measurements entirely.
                    // During 'refine' (longer, variable), we allow it.
                    if (phaseRef.current !== 'seed') {
                        const resizeStart = performance.now();
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';
                        perfCountersRef.current.maxResizeMs = Math.max(perfCountersRef.current.maxResizeMs, performance.now() - resizeStart);
                    } else {
                        // Ensure min height during seed so it doesn't collapse
                        // (Assuming MIN_HEIGHT is enough for 1 line)
                        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
                    }

                    // CRITICAL CHANGE: We do NOT calling setInputText(nextVal) here.
                    // This prevents React re-renders @ 60fps.
                    // We sync state only on completion or external events.

                    // Reset guard in microtask
                    queueMicrotask(() => {
                        isProgrammaticSetRef.current = false;
                    });
                }
                lastLen = nextLen;
            }

            perfCountersRef.current.maxTickMs = Math.max(perfCountersRef.current.maxTickMs, performance.now() - tickStart);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                // Ensure final state is perfect
                if (textareaRef.current && textareaRef.current.value !== targetText) {
                    isProgrammaticSetRef.current = true;
                    textareaRef.current.value = targetText;

                    // Final resize is mandatory
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';

                    queueMicrotask(() => { isProgrammaticSetRef.current = false; });
                }

                // Sync React state at the end
                setInputText(targetText);

                // Log Perf if Seed
                if (phaseRef.current === 'seed') {
                    console.log(`[PrefillPerf] seed ticks=${perfCountersRef.current.seedTicks} maxTickMs=${perfCountersRef.current.maxTickMs.toFixed(2)} maxResizeMs=${perfCountersRef.current.maxResizeMs.toFixed(2)}`);
                }

                onDone();
            }
        };

        rafRef.current = requestAnimationFrame(tick);
    }, []);


    // --- Helper: Start Refine Phase ---
    const startRefine = useCallback(() => {
        const runId = currentRunIdRef.current;
        const text = refinedTextRef.current;

        if (!runId || !text) return;

        console.log('[Prefill] phase refine');
        phaseRef.current = 'refine';

        // Duration based on length, clamped
        // e.g. 50 chars => 1.5s, 100 chars => 3s? 
        // Let's make it snappier: 30ms per char, min 700ms, max 1200ms
        const duration = Math.min(Math.max(700, text.length * 30), 1200);

        streamToText(runId, text, duration, () => {
            console.log('[Prefill] refine done');
            phaseRef.current = 'idle';
        });
    }, [streamToText]);


    // --- Store Sync Effect ---
    useEffect(() => {
        const { runId, seed, refined } = fullChat.prefill;

        // 1. New Run Detected
        if (runId !== 0 && runId !== currentRunIdRef.current) {
            cancelEverything("new_run");

            currentRunIdRef.current = runId;
            setDirtySincePrefill(false); // Reset dirty flag
            seedTextRef.current = seed || '';
            refinedTextRef.current = null;
            breathDoneRef.current = false;

            if (seed) {
                console.log('[Prefill] phase seed');
                phaseRef.current = 'seed';

                // Clear input first
                if (textareaRef.current) {
                    isProgrammaticSetRef.current = true;
                    textareaRef.current.value = '';
                    setInputText(''); // Sync empty
                    textareaRef.current.focus();
                    queueMicrotask(() => { isProgrammaticSetRef.current = false; });
                }

                // Stream Seed (500ms)
                streamToText(runId, seed, 500, () => {
                    if (phaseRef.current !== 'seed') return; // Interrupted

                    console.log('[Prefill] phase breath');
                    phaseRef.current = 'breath';

                    // Breath Timer (500ms pause)
                    breathTimerRef.current = window.setTimeout(() => {
                        breathDoneRef.current = true;
                        breathTimerRef.current = null;

                        // Breath done. If we already have refined text, go!
                        if (refinedTextRef.current && !dirtySincePrefill) {
                            startRefine();
                        } else {
                            // Wait in idle, but marked breathDone
                            phaseRef.current = 'idle';
                        }
                    }, 500);
                });
            }
        }

        // 2. Refined Text Arrived
        if (runId === currentRunIdRef.current && refined && refined !== refinedTextRef.current) {
            refinedTextRef.current = refined;

            if (dirtySincePrefill) {
                console.log('[Prefill] refine_ready apply=NO reason=dirty');
                return;
            }

            // Logic to trigger refine based on current phase
            if (breathDoneRef.current) {
                // Breath already finished -> go immediately
                startRefine();
            } else {
                // Breath still running or seed running -> do nothing, the callback chains will pick it up
                console.log('[Prefill] refine_ready apply=PENDING reason=waiting_for_breath');
            }
        }

    }, [fullChat.prefill, dirtySincePrefill, cancelEverything, streamToText, startRefine]);

    // --- Sync Textarea (Uncontrolled Mode Support) ---
    // Since we removed 'value={inputText}', we must manually push state updates to DOM
    // when NOT in a streaming phase.
    useEffect(() => {
        if (phaseRef.current !== 'idle') return;

        if (textareaRef.current && textareaRef.current.value !== inputText) {
            textareaRef.current.value = inputText;
            // Also adjust height
            textareaRef.current.style.height = `${MIN_HEIGHT}px`;
            const newHeight = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [inputText]);


    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Critical: Ignore programmatic updates
        if (isProgrammaticSetRef.current) return;

        // User typed!
        if (!dirtySincePrefill) {
            setDirtySincePrefill(true);
            cancelEverything("user_dirty");
        }

        setInputText(e.target.value);
    };

    const focusLabel = getNodeLabel(currentFocusNodeId);

    // Auto-scroll when at bottom and content changes
    // Using messagesEndRef.current to avoid triggering on every message update
    const lastMessageTimestamp = fullChat.messages[fullChat.messages.length - 1]?.timestamp;
    useEffect(() => {
        if (isAtBottom && messagesEndRef.current) {
            // Use requestAnimationFrame to batch with browser paint
            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }, [lastMessageTimestamp, isAtBottom]);

    // Show/hide "Jump to Latest" pill
    useEffect(() => {
        setShowJumpToLatest(!isAtBottom && fullChat.isStreaming);
    }, [isAtBottom, fullChat.isStreaming]);

    // Track scroll position
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD;
        setIsAtBottom(atBottom);
    }, []);

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

    const handleSend = useCallback(() => {
        // Prevent double-send and empty sends
        if (isSendingRef.current || !inputText.trim() || fullChat.isStreaming) return;

        isSendingRef.current = true;
        const textToSend = inputText.trim();

        // Clear input immediately (same frame feel)
        setInputText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = `${MIN_HEIGHT}px`;
        }

        // Ensure we're at bottom for the response
        setIsAtBottom(true);

        // Send message (creates user + streaming AI placeholder)
        fullChat.sendMessage(textToSend);

        // Start streaming simulation
        streamSimulator.startStream(
            MOCK_AI_RESPONSE,
            (text) => fullChat.updateStreamingMessage(text),
            () => fullChat.completeStreamingMessage()
        );

        // Reset send lock after a tick
        setTimeout(() => { isSendingRef.current = false; }, 50);
    }, [inputText, fullChat, streamSimulator]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleJumpToLatest = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setIsAtBottom(true);
    }, []);

    // Get message style with turn spacing
    // Optimized to not recreate on every message update during streaming
    const getMessageStyle = useCallback((msg: FullChatMessage, prevMsg: FullChatMessage | undefined): React.CSSProperties => {
        const base = msg.role === 'user' ? MESSAGE_STYLE_USER : MESSAGE_STYLE_AI;

        // Extra top margin when switching from AI to User (new turn)
        const isNewTurn = prevMsg && prevMsg.role === 'ai' && msg.role === 'user';

        if (!isNewTurn) return base;

        return {
            ...base,
            marginTop: '12px',
        };
    }, []);

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
                <div style={MESSAGES_WRAPPER_STYLE} className="arnvoid-scroll-fades">
                    <div
                        ref={messagesContainerRef}
                        style={MESSAGES_CONTAINER_STYLE}
                        className="arnvoid-scroll"
                        onScroll={handleScroll}
                    >
                        {fullChat.messages.map((msg, i) => (
                            <div
                                key={msg.timestamp}
                                style={getMessageStyle(msg, fullChat.messages[i - 1])}
                            >
                                {msg.text}
                                {msg.status === 'streaming' && <StreamingDots />}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Jump to Latest pill */}
                    {showJumpToLatest && (
                        <button
                            style={JUMP_TO_LATEST_STYLE}
                            onClick={handleJumpToLatest}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                        >
                            <span>↓</span>
                            <span>Latest</span>
                        </button>
                    )}
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
            <div style={{ ...INPUT_CONTAINER_STYLE, position: 'relative' }}>
                <textarea
                    ref={textareaRef}
                    // UNCONTROLLED for performance (value managed manually during stream)
                    defaultValue=""
                    // value={inputText} <--- REMOVE
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Trace the thought here…"
                    style={{ ...INPUT_FIELD_STYLE, height: `${MIN_HEIGHT}px` }}
                    rows={1}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = VOID.lineEnergy;
                        e.currentTarget.style.boxShadow = `inset 0 1px 4px ${VOID.energyFaint}`;
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = VOID.line;
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                />
                <SendButton onClick={handleSend} disabled={!inputText.trim() || fullChat.isStreaming} />
            </div>
        </div>
    );
};
