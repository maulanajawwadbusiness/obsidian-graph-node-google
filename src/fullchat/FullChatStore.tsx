import { createContext, useContext, useState, ReactNode } from 'react';
import type { FullChatState, FullChatContextValue, FullChatMessage, MiniChatContext } from './fullChatTypes';

/**
 * Full Chat Store - React Context for managing full chatbar state
 * Follows the existing simple state management pattern in the codebase
 */

const initialState: FullChatState = {
    isOpen: false,
    messages: [],
    pendingContext: null,
};

const FullChatContext = createContext<FullChatContextValue | null>(null);

export function FullChatProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<FullChatState>(initialState);

    const openFullChat = () => {
        console.log('[FullChat] Toggled: true');
        setState(prev => ({ ...prev, isOpen: true }));
    };

    const closeFullChat = () => {
        console.log('[FullChat] Toggled: false');
        setState(prev => ({ ...prev, isOpen: false }));
    };

    const toggleFullChat = () => {
        setState(prev => {
            const next = !prev.isOpen;
            console.log('[FullChat] Toggled:', next);
            return { ...prev, isOpen: next };
        });
    };

    const sendMessage = (text: string) => {
        console.log('[FullChat] Sending message:', text);
        const userMessage: FullChatMessage = {
            role: 'user',
            text,
            timestamp: Date.now(),
        };

        // Mock AI reply (v1)
        const aiMessage: FullChatMessage = {
            role: 'ai',
            text: 'This is a mock AI response. In the future, this will be a real AI-powered reply based on the node and document context.',
            timestamp: Date.now() + 1,
        };

        setState(prev => ({
            ...prev,
            messages: [...prev.messages, userMessage, aiMessage],
        }));
    };

    const receiveFromMiniChat = (context: MiniChatContext) => {
        console.log('[FullChat] Handoff received:', context);
        setState(prev => ({
            ...prev,
            pendingContext: context,
            isOpen: true,
        }));
    };

    const clearPendingContext = () => {
        setState(prev => ({ ...prev, pendingContext: null }));
    };

    const contextValue: FullChatContextValue = {
        ...state,
        openFullChat,
        closeFullChat,
        toggleFullChat,
        sendMessage,
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
