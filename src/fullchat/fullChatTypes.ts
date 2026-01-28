/**
 * Full Chatbar System Types
 * State and action interfaces for the right-dock chat panel
 */

export interface FullChatMessage {
    role: 'user' | 'ai';
    text: string;
    timestamp: number;
    status: 'sending' | 'sent' | 'streaming' | 'complete';
}

export interface MiniChatContext {
    miniChatMessages: Array<{ role: 'user' | 'ai'; text: string }>;
    nodeLabel: string;
    content?: { title: string; summary: string } | null;
    suggestedPrompt?: string;
}

export interface PrefillState {
    runId: number;
    seed: string | null;
    refined: string | null;
    status: 'idle' | 'seeded' | 'refining' | 'ready';
}

export interface FullChatState {
    isOpen: boolean;
    messages: FullChatMessage[];
    pendingContext: MiniChatContext | null;
    prefill: PrefillState;
    isStreaming: boolean;
}

export interface FullChatActions {
    openFullChat: () => void;
    closeFullChat: () => void;
    toggleFullChat: () => void;
    sendMessage: (text: string, context: AiContext) => void;
    updateStreamingMessage: (text: string) => void;
    completeStreamingMessage: () => void;
    receiveFromMiniChat: (context: MiniChatContext) => void;
    clearPendingContext: () => void;
}


export interface AiContext {
    nodeLabel: string | null;
    documentText: string | null;
    documentTitle: string | null;
    recentHistory: FullChatMessage[];
}

export type FullChatContextValue = FullChatState & FullChatActions;

