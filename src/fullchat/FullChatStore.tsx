import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { FullChatState, FullChatContextValue, FullChatMessage, MiniChatContext } from './fullChatTypes';

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
};

const FullChatContext = createContext<FullChatContextValue | null>(null);

export function FullChatProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<FullChatState>(initialState);

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
        setState(prev => ({
            ...prev,
            pendingContext: context,
            isOpen: true,
        }));
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
