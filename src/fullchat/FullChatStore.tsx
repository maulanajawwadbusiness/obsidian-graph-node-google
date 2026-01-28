import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import type { FullChatState, FullChatContextValue, FullChatMessage, MiniChatContext } from './fullChatTypes';
import { makeSeedPrompt, refinePromptAsync } from './prefillSuggestion';

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
    prefill: { seed: null, refined: null, status: 'idle', jobId: 0 },
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

    // Send user message and create placeholder for AI response
    const sendMessage = useCallback((text: string) => {
        console.log('[FullChat] Sending message:', text);
        const userMessage: FullChatMessage = {
            role: 'user',
            text,
            timestamp: Date.now(),
            status: 'sent',  // User messages are instantly "sent"
        };

        // Create streaming AI message placeholder
        const aiMessage: FullChatMessage = {
            role: 'ai',
            text: '',  // Empty initially, will be filled by streaming
            timestamp: Date.now() + 1,
            status: 'streaming',
        };

        setState(prev => ({
            ...prev,
            messages: [...prev.messages, userMessage, aiMessage],
            isStreaming: true,
        }));
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
            const nextJobId = prev.prefill.jobId + 1;

            // Start async refine side-effect
            // Note: We intentionally fire-and-forget this promise, handling state updates inside.
            (async () => {
                console.log('[Prefill] refine_started', { jobId: nextJobId });
                try {
                    const refined = await refinePromptAsync({
                        nodeLabel: context.nodeLabel,
                        miniChatMessages: context.miniChatMessages
                    }, { signal });

                    setState(curr => {
                        // Check staleness
                        if (curr.prefill.jobId !== nextJobId) {
                            console.log('[Prefill] refine_canceled reason=stale_job', { jobId: nextJobId });
                            return curr;
                        }

                        console.log('[Prefill] refine_ready', { refined });
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
                    if (err instanceof Error && err.message === 'Aborted') return;
                    console.error('[Prefill] Refine error', err);
                }
            })();

            return {
                ...prev,
                pendingContext: context, // Keep for reference if needed
                isOpen: true,
                prefill: {
                    seed,
                    refined: null,
                    status: 'seeded',
                    jobId: nextJobId
                },
                pendingSuggestion: null  // Clear any old suggestion
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
