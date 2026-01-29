import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import type { FullChatState, FullChatContextValue, FullChatMessage, MiniChatContext } from './fullChatTypes';
import { makeSeedPrompt, refinePromptAsync } from './prefillSuggestion';
import { generateResponseAsync } from './fullChatAi';
import type { AiContext } from './fullChatTypes';

/**
 * Full Chat Store - React Context for managing full chatbar state
 * 
 * Supports:
 * - Message status transitions (sending → sent, streaming → complete)
 * - Streaming updates (text grows over time)
 * - Smooth conversation flow
 */

const initialState: FullChatState = {
    isOpen: false,
    messages: [],
    pendingContext: null,
    isStreaming: false,
    prefill: { runId: 0, seed: null, refined: null, status: 'idle' },
};

const FullChatContext = createContext<FullChatContextValue | null>(null);

export function FullChatProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<FullChatState>(initialState);
    const refineAbortController = useRef<AbortController | null>(null);

    const openFullChat = useCallback(() => {
        console.log('[FullChat] Toggled: true');
        setState(prev => ({ ...prev, isOpen: true }));
    }, []);

    const closeFullChat = useCallback(() => {
        console.log('[FullChat] Toggled: false');
        setState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const toggleFullChat = useCallback(() => {
        setState(prev => {
            const next = !prev.isOpen;
            console.log('[FullChat] Toggled:', next);
            return { ...prev, isOpen: next };
        });
    }, []);


    // Update the current streaming message with new text
    const updateStreamingMessage = useCallback((text: string) => {
        setState(prev => {
            const messages = [...prev.messages];
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0 && messages[lastIdx].status === 'streaming') {
                messages[lastIdx] = { ...messages[lastIdx], text };
            }
            return { ...prev, messages };
        });
    }, []);

    // Mark streaming as complete
    const completeStreamingMessage = useCallback(() => {
        console.log('[FullChat] Streaming complete');
        setState(prev => {
            const messages = [...prev.messages];
            const lastIdx = messages.length - 1;
            if (lastIdx >= 0 && messages[lastIdx].status === 'streaming') {
                messages[lastIdx] = { ...messages[lastIdx], status: 'complete' };
            }
            return { ...prev, messages, isStreaming: false };
        });
    }, []);

    // Send user message and create placeholder for AI response
    // context is now required for AI generation
    const sendMessage = useCallback((text: string, context: AiContext) => {
        console.log(`[AI_SEND] surface=fullchat lang=${context.nodeLabel ? 'id' : 'en'} message="${text}"`);

        // 1. Cancel previous generation if any
        if (refineAbortController.current) {
            refineAbortController.current.abort();
            console.log('[FullChatAI] previous_aborted reason=new_message');
        }
        refineAbortController.current = new AbortController();
        const signal = refineAbortController.current.signal;

        const userMessage: FullChatMessage = {
            role: 'user',
            text,
            timestamp: Date.now(),
            status: 'sent',
        };

        const aiMessage: FullChatMessage = {
            role: 'ai',
            text: '',
            timestamp: Date.now() + 1,
            status: 'streaming',
        };

        setState(prev => ({
            ...prev,
            messages: [...prev.messages, userMessage, aiMessage],
            isStreaming: true,
        }));

        // 2. Start Async Generation
        (async () => {
            try {
                // Combine history: store messages + new user message
                // The context passed in has "recentHistory" from component, 
                // but we should probably trust the Store's history more or merge them?
                // The component passed "recentHistory" in context. Let's use that + the new user message.
                // Actually, the component constructed the context.
                // We just pass it through.

                // We just pass it through.

                // We just pass it through.

                const generator = generateResponseAsync(text, context, signal);

                let accumulatedText = '';
                let lastUpdate = 0;

                for await (const chunk of generator) {
                    if (signal.aborted) break;

                    accumulatedText += chunk;
                    const now = Date.now();

                    // Throttle updates to ~30fps (32ms) to save React cycles
                    // visual streaming is handled by CSS/native feel, but data needs to be there.
                    if (now - lastUpdate > 32) {
                        updateStreamingMessage(accumulatedText);
                        lastUpdate = now;
                    }
                }

                // Final update to ensure complete text
                if (!signal.aborted) {
                    updateStreamingMessage(accumulatedText);
                    completeStreamingMessage();
                }

            } catch (err) {
                if (signal.aborted) return;
                console.error('[FullChatAI] generation failed', err);
                // On error, maybe append an error message or just stop streaming?
                // For "robustness", we stop streaming. Text stays as is (maybe empty).
                completeStreamingMessage();
            }
        })();

    }, [updateStreamingMessage, completeStreamingMessage]);



    const receiveFromMiniChat = useCallback((context: MiniChatContext) => {
        console.log('[FullChat] Handoff received:', context);

        // 1. Generate Seed (Instant)
        const seed = makeSeedPrompt({
            nodeLabel: context.nodeLabel,
            miniChatMessages: context.miniChatMessages
        });
        console.log('[Prefill] seed_applied', { seed });

        // 2. Manage Refine Job
        if (refineAbortController.current) {
            refineAbortController.current.abort();
            console.log('[Prefill] refine_canceled reason=new_handoff');
        }
        refineAbortController.current = new AbortController();
        const signal = refineAbortController.current.signal;

        setState(prev => {
            const nextRunId = (prev.prefill.runId || 0) + 1;
            console.log('[Prefill] run_start', { runId: nextRunId, seed });

            // Start async refine side-effect
            // -----------------------------------------------------------------
            // Edge Case Protection: New Run cancels Previous Refine
            // -----------------------------------------------------------------
            (async () => {
                const myRunId = nextRunId;
                try {
                    const refined = await refinePromptAsync({
                        nodeLabel: context.nodeLabel,
                        miniChatMessages: context.miniChatMessages
                    }, { signal });

                    if (signal.aborted) {
                        console.log(`[Prefill] refine_aborted runId=${myRunId}`);
                        return;
                    }

                    setState(curr => {
                        // 1. Stale Guard: If runId moved on, ignore (spam click protection)
                        if (curr.prefill.runId !== myRunId) {
                            console.log(`[Prefill] refine_ignored reason=stale runId=${myRunId} curr=${curr.prefill.runId}`);
                            return curr;
                        }

                        // 2. Ready
                        console.log(`[Prefill] refine_ready runId=${myRunId} len=${refined.length}`);
                        return {
                            ...curr,
                            prefill: {
                                ...curr.prefill,
                                refined,
                                status: 'ready'
                            }
                        };
                    });
                } catch (err: unknown) {
                    if (err instanceof Error && err.name === 'AbortError') {
                        console.log(`[Prefill] refine_aborted_caught runId=${myRunId}`);
                        return;
                    }
                    console.error(`[Prefill] refine_error runId=${myRunId}`, err);
                }
            })();

            return {
                ...prev,
                pendingContext: context,
                isOpen: true,
                prefill: {
                    runId: nextRunId,
                    seed,
                    refined: null,
                    status: 'seeded',
                },
            };
        });
    }, []);

    const clearPendingContext = useCallback(() => {
        setState(prev => ({ ...prev, pendingContext: null }));
    }, []);

    const contextValue: FullChatContextValue = {
        ...state,
        openFullChat,
        closeFullChat,
        toggleFullChat,
        sendMessage,
        updateStreamingMessage,
        completeStreamingMessage,
        receiveFromMiniChat,
        clearPendingContext,
    };

    return (
        <FullChatContext.Provider value={contextValue}>
            {children}
        </FullChatContext.Provider>
    );
}

export function useFullChat(): FullChatContextValue {
    const context = useContext(FullChatContext);
    if (!context) {
        throw new Error('useFullChat must be used within FullChatProvider');
    }
    return context;
}
