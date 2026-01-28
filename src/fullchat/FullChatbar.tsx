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

    // Strict Mode Guards (Unset = -1, or active runId)
    const lastSeedStartRunIdRef = useRef<number>(-1);
    const lastRefineStartRunIdRef = useRef<number>(-1);

    // Fail-Safe Refs
    const hardTimeoutRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    // Performance Counters
    const perfCountersRef = useRef({
        seedTicks: 0,
        maxTickMs: 0,
        maxResizeMs: 0,
        lastResizeTime: 0,
        seedUpdates: 0,
        refineUpdates: 0,
        autosizeCalls: 0,
        scrollWrites: 0,
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isSendingRef = useRef(false);  // Prevent double-send

    // Scroll State Refs (for reliable instant access in callbacks)
    const isUserNearBottomRef = useRef(true);
    const pendingScrollRef = useRef<number | null>(null);

    const currentFocusNodeId = popupContext.isOpen ? popupContext.selectedNodeId : null;

    // Mounted Check
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const getNodeLabel = (nodeId: string | null): string | null => {
        if (!nodeId || !engineRef.current) return null;
        return engineRef.current.nodes.get(nodeId)?.label ?? null;
    };

    // --- Helper: Cancellation ---
    const cancelEverything = useCallback((reason: string) => {
        const rId = currentRunIdRef.current;
        console.log(`[Prefill] cancel reason=${reason} runId=${rId}`);

        // 1. Stop streaming loop
        streamTokenRef.current++; // Invalidates ANY active tick
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        // 2. Stop breath timer
        if (breathTimerRef.current) {
            clearTimeout(breathTimerRef.current);
            breathTimerRef.current = null;
        }

        // 3. Stop hard timeout
        if (hardTimeoutRef.current) {
            clearTimeout(hardTimeoutRef.current);
            hardTimeoutRef.current = null;
        }

        // 4. Reset phase
        phaseRef.current = 'idle';

        // Note: We do NOT clear currentRunIdRef here, as we might be cancelling
        // to prepare for the *same* run or just stopping activity.

        // Log Summary if reason implies termination
        if (reason !== 'new_run' && reason !== 'resize') {
            // For new_run we log start separately.
            // For others, we assume this is an 'end'.
        }
    }, []);

    // --- Helper: Snap to Stable State (Fail-Safe) ---
    const snapToStable = useCallback((reason: string) => {
        // Guard: Dirty or unmounted
        if (dirtySincePrefill || !isMountedRef.current) return;

        // Determine best stable text
        let targetText: string | null = null;
        // If we have refined, prefer that. Else seed.
        targetText = refinedTextRef.current || seedTextRef.current;

        if (targetText !== null && textareaRef.current) {
            console.log(`[Prefill] snap action=${reason} textLen=${targetText.length}`);
            isProgrammaticSetRef.current = true;
            textareaRef.current.value = targetText;
            setInputText(targetText); // Sync React state instantly

            // Force quick resize
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';

            queueMicrotask(() => { isProgrammaticSetRef.current = false; });

            // Log End of Run
            console.log(`[PrefillRun] runId=${currentRunIdRef.current} end=snapped reason=${reason}`);
        }
    }, [dirtySincePrefill]);

    // --- Helper: Ease Out Cubic ---
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // --- Helper: Deterministic Streaming ---
    const streamToText = useCallback((targetRunId: number, targetText: string, durationMs: number, onDone: () => void) => {
        // Guard: If we are already dirty or stale before starting, abort immediately
        if (dirtySincePrefill || targetRunId !== currentRunIdRef.current || !isMountedRef.current) {
            console.log(`[Prefill] stream_start_blocked runId=${targetRunId} dirty=${dirtySincePrefill}`);
            return;
        }

        // Setup new stream
        streamTokenRef.current++;
        const myToken = streamTokenRef.current;
        const startTime = performance.now();

        // Reset counters for phase start
        if (phaseRef.current === 'seed') {
            perfCountersRef.current = {
                ...perfCountersRef.current,
                seedTicks: 0, maxTickMs: 0, maxResizeMs: 0, seedUpdates: 0, autosizeCalls: 0
            };
        } else if (phaseRef.current === 'refine') {
            perfCountersRef.current = {
                ...perfCountersRef.current,
                refineUpdates: 0
            };
        }

        let lastLen = 0; // optimization: only touch DOM if length changed

        const tick = () => {
            // Try/Catch Guard against uncaught errors breaking the loop state
            try {
                // -----------------------------------------------------------------
                // CRITICAL GUARD: Run Integrity / Token Integrity / User Dirty / Mount
                // -----------------------------------------------------------------
                if (
                    myToken !== streamTokenRef.current ||       // Newer stream started
                    targetRunId !== currentRunIdRef.current ||  // Newer run started
                    dirtySincePrefill ||                        // User took over
                    !isMountedRef.current                       // Unmounted
                ) {
                    return;
                }
                // -----------------------------------------------------------------

                const tickStart = performance.now();
                if (phaseRef.current === 'seed') perfCountersRef.current.seedTicks++;

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

                        if (phaseRef.current === 'seed') {
                            perfCountersRef.current.seedUpdates++;
                            // Seed: Fixed height to prevent jitter
                            textareaRef.current.style.height = `${MIN_HEIGHT}px`;
                        } else {
                            perfCountersRef.current.refineUpdates++;
                            // Refine: Throttled Autosize
                            if (now - perfCountersRef.current.lastResizeTime > 50) {
                                perfCountersRef.current.autosizeCalls++;
                                const resizeStart = performance.now();
                                textareaRef.current.style.height = 'auto';
                                const scrollHeight = textareaRef.current.scrollHeight;
                                textareaRef.current.style.height = Math.min(scrollHeight, MAX_HEIGHT) + 'px';

                                perfCountersRef.current.lastResizeTime = now;
                                perfCountersRef.current.maxResizeMs = Math.max(perfCountersRef.current.maxResizeMs, now - resizeStart);
                            }
                        }

                        // Reset guard in microtask
                        queueMicrotask(() => {
                            isProgrammaticSetRef.current = false;
                        });
                    }
                    lastLen = nextLen;
                }

                const tickTime = performance.now() - tickStart;
                perfCountersRef.current.maxTickMs = Math.max(perfCountersRef.current.maxTickMs, tickTime);

                // Perf Budget Warning (Dev Only helpful)
                if (tickTime > 12) {
                    // console.warn(`[PrefillPerfWarn] slow tick ${tickTime.toFixed(1)}ms phase=${phaseRef.current}`);
                }

                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    // Final Check
                    if (targetRunId !== currentRunIdRef.current || dirtySincePrefill || !isMountedRef.current) return;

                    // Ensure final state
                    if (textareaRef.current && textareaRef.current.value !== targetText) {
                        isProgrammaticSetRef.current = true;
                        textareaRef.current.value = targetText;

                        // Final resize
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';

                        queueMicrotask(() => { isProgrammaticSetRef.current = false; });
                    }

                    setInputText(targetText);

                    // Log Perf Summary
                    if (phaseRef.current === 'seed') {
                        console.log(`[PrefillPerf] phase=seed updates=${perfCountersRef.current.seedUpdates} maxTickMs=${perfCountersRef.current.maxTickMs.toFixed(2)} autosize=${perfCountersRef.current.autosizeCalls}`);
                    } else if (phaseRef.current === 'refine') {
                        console.log(`[PrefillPerf] phase=refine updates=${perfCountersRef.current.refineUpdates} maxTickMs=${perfCountersRef.current.maxTickMs.toFixed(2)} autosize=${perfCountersRef.current.autosizeCalls}`);
                        // Refine End = Run Complete usually
                        console.log(`[PrefillRun] runId=${targetRunId} end=refined`);
                        // Clear hard timeout on success
                        if (hardTimeoutRef.current) { clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null; }
                    }

                    onDone();
                }
            } catch (err) {
                console.error(`[PrefillError] tick_failed runId=${targetRunId}`, err);
                cancelEverything("tick_error");
                snapToStable("tick_error");
            }
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [dirtySincePrefill, snapToStable, cancelEverything]);


    // --- Helper: Start Refine Phase ---
    const startRefine = useCallback(() => {
        const runId = currentRunIdRef.current;
        const text = refinedTextRef.current;

        // Security check
        if (!runId || !text || !isMountedRef.current) return;
        if (dirtySincePrefill) return;

        // Strict Mode Guard: Prevent duplicate start
        if (lastRefineStartRunIdRef.current === runId) {
            console.log(`[StrictGuard] prevented duplicate refine start runId=${runId}`);
            return;
        }
        lastRefineStartRunIdRef.current = runId;

        console.log(`[Prefill] phase refine runId=${runId}`);
        phaseRef.current = 'refine';

        const duration = Math.min(Math.max(700, text.length * 30), 1200);

        streamToText(runId, text, duration, () => {
            console.log(`[Prefill] refine_done runId=${runId}`);
            phaseRef.current = 'idle';
        });
    }, [streamToText, dirtySincePrefill]);


    // --- Store Sync Effect ---
    useEffect(() => {
        const { runId, seed, refined } = fullChat.prefill;

        // ---------------------------------------------------------------------
        // 1. New Run Detected
        // ---------------------------------------------------------------------
        if (runId !== 0 && runId !== currentRunIdRef.current) {
            cancelEverything("new_run");

            currentRunIdRef.current = runId;
            setDirtySincePrefill(false); // Reset dirty flag
            seedTextRef.current = seed || '';
            refinedTextRef.current = null;
            breathDoneRef.current = false;

            console.log(`[Prefill] run_start runId=${runId}`);

            // Start Hard Timeout (Fail-Safe) - 3000ms max for whole flow
            hardTimeoutRef.current = window.setTimeout(() => {
                if (currentRunIdRef.current === runId && !dirtySincePrefill && isMountedRef.current) {
                    console.warn(`[PrefillWarn] hard_timeout fired runId=${runId}`);
                    cancelEverything("hard_timeout");
                    snapToStable("hard_timeout");
                }
            }, 3000);

            if (seed) {
                // Strict Mode Guard: Prevent duplicate start for same runId
                if (lastSeedStartRunIdRef.current === runId) {
                    console.log(`[StrictGuard] prevented duplicate seed start runId=${runId}`);
                    // If we skipped start, we assume the previous effect instance is handling it.
                    // IMPORTANT: To support StrictMode unmount killing the stream, strictly guarding
                    // against restart might be wrong IF the cleanup killed it.
                    // However, we consciously chose NOT to clean up the store effect on unmount,
                    // so the previous stream persists. Thus, guarding here is correct to prevent doubling.
                } else {
                    lastSeedStartRunIdRef.current = runId;

                    console.log(`[Prefill] phase seed runId=${runId}`);
                    phaseRef.current = 'seed';

                    // Clear input first
                    if (textareaRef.current) {
                        isProgrammaticSetRef.current = true;
                        textareaRef.current.value = '';
                        setInputText('');
                        textareaRef.current.focus();
                        queueMicrotask(() => { isProgrammaticSetRef.current = false; });
                    }

                    // Stream Seed (500ms)
                    streamToText(runId, seed, 500, () => {
                        // Callback Guard
                        if (currentRunIdRef.current !== runId || dirtySincePrefill) return;

                        console.log(`[Prefill] phase breath runId=${runId}`);
                        phaseRef.current = 'breath';

                        // Breath Timer (500ms pause)
                        breathTimerRef.current = window.setTimeout(() => {
                            breathDoneRef.current = true;
                            breathTimerRef.current = null;

                            // Strict Callback Guard inside Timeout
                            if (currentRunIdRef.current !== runId || dirtySincePrefill) return;

                            // Breath done. If we already have refined text, go!
                            if (refinedTextRef.current) {
                                startRefine();
                            } else {
                                // Wait in idle, but marked breathDone
                                // We do NOT set phase='idle' here, we stay in 'breath' waiting for refine?
                                // Actually 'idle' is safer to prevent confusing logic.
                                // But we need to know we are "ready for refine".
                                // Let's rely on breathDoneRef + idle check in the other effect.
                                phaseRef.current = 'idle';
                            }
                        }, 500);
                    });
                }
            }
        }

        // ---------------------------------------------------------------------
        // 2. Refined Text Arrived
        // ---------------------------------------------------------------------
        if (runId === currentRunIdRef.current && refined && refined !== refinedTextRef.current) {
            refinedTextRef.current = refined;

            if (dirtySincePrefill) {
                console.log(`[Prefill] refine_ready apply=NO reason=dirty runId=${runId}`);
                return;
            }

            // Logic to trigger refine based on current phase
            if (breathDoneRef.current) {
                // Breath already finished -> go immediately
                startRefine();
            } else {
                console.log(`[Prefill] refine_ready apply=PENDING reason=waiting_for_breath runId=${runId}`);
            }
        }

    }, [fullChat.prefill, dirtySincePrefill, cancelEverything, streamToText, startRefine, snapToStable]);

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
            const runId = currentRunIdRef.current;
            console.log(`[Prefill] dirty user_takeover runId=${runId}`);
            cancelEverything("user_dirty");
        }

        setInputText(e.target.value);
    };

    const focusLabel = getNodeLabel(currentFocusNodeId);

    // -------------------------------------------------------------------------
    // SCROLL HARDENING
    // -------------------------------------------------------------------------

    // A helper to safely scroll to bottom if allowed
    const safeScrollToBottom = useCallback((reason: string) => {
        if (!messagesEndRef.current || !isUserNearBottomRef.current) {
            // console.log(`[AutoScroll] ignore reason=userAway triggers=${reason}`);
            return;
        }

        // Cancel any pending scroll
        if (pendingScrollRef.current) {
            cancelAnimationFrame(pendingScrollRef.current);
        }

        // Schedule new one
        pendingScrollRef.current = requestAnimationFrame(() => {
            if (isUserNearBottomRef.current && messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                // console.log(`[AutoScroll] applied reason=nearBottom source=${reason}`);
            }
            pendingScrollRef.current = null;
        });
    }, []);

    // -------------------------------------------------------------------------
    // VISIBILITY & RESIZE HARDENING (Edge Cases #5 & #6)
    // -------------------------------------------------------------------------

    const snapToFinalState = useCallback((reason: string) => {
        // If we are dirty, do nothing (user owns state)
        if (dirtySincePrefill) return;

        // Determine what text "should" be there
        let targetText: string | null = null;
        if (phaseRef.current === 'seed') {
            targetText = seedTextRef.current;
        } else if (phaseRef.current === 'refine' || (phaseRef.current === 'idle' && refinedTextRef.current)) {
            // If we have refined text, snap to it. Otherwise stick with seed.
            targetText = refinedTextRef.current || seedTextRef.current;
        } else if (phaseRef.current === 'breath') {
            targetText = seedTextRef.current;
        }

        if (targetText !== null && textareaRef.current) {
            console.log(`[Prefill] snap action=${reason} textLen=${targetText.length}`);
            isProgrammaticSetRef.current = true;
            textareaRef.current.value = targetText;
            setInputText(targetText); // Sync React state instantly

            // Force quick resize
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';

            queueMicrotask(() => { isProgrammaticSetRef.current = false; });
        }
    }, [dirtySincePrefill]);

    // Visibility Handling
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log(`[Prefill] visibility hidden`);
                // Stop everything instantly
                cancelEverything("tab_hidden");
                // Snap to final state to avoid "brick jump" on return
                snapToFinalState("tab_hidden");
            } else {
                console.log(`[Prefill] visibility visible`);
                // Do NOT restart. Stay snapped/idle. "It just works".
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [cancelEverything, snapToFinalState]);

    // Resize Handling (Throttled)
    const resizeTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        const handleResize = () => {
            // 1. Instant Stop on Resize Start (First event)
            if (phaseRef.current !== 'idle') {
                console.log(`[Prefill] resize start`);
                cancelEverything("resize");
                snapToFinalState("resize");
            }

            // 2. Debounce End of Resize (to fix layout)
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }

            resizeTimeoutRef.current = window.setTimeout(() => {
                console.log(`[Prefill] resize settle`);
                resizeTimeoutRef.current = null;
                // Force one autosize pass after layout settles
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT) + 'px';
                }
            }, 150);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };
    }, [cancelEverything, snapToFinalState]);


    // 1. Instant Scroll on New Message Update (e.g. user sent, or new streaming text chunk)
    const lastMessage = fullChat.messages[fullChat.messages.length - 1];

    // We use a layout effect to check scroll position *before* browser paint if possible, 
    // but here we just want to trigger the safe scroll when data changes.
    useEffect(() => {
        if (!lastMessage) return;

        // Trigger scroll check
        safeScrollToBottom('message_update');
    }, [lastMessage, safeScrollToBottom]);


    // Show/hide "Jump to Latest" pill
    useEffect(() => {
        setShowJumpToLatest(!isAtBottom && fullChat.isStreaming);
    }, [isAtBottom, fullChat.isStreaming]);

    // Track scroll position
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = dist < SCROLL_BOTTOM_THRESHOLD;

        setIsAtBottom(atBottom);
        isUserNearBottomRef.current = atBottom;
    }, []);

    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Safety: disable adjust during streaming externally
        if (phaseRef.current !== 'idle') return;

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
