/**
 * Full Chatbar System Types
 * State and action interfaces for the right-dock chat panel
 */

export interface FullChatMessage {
    role: 'user' | 'ai';
    text: string;
    timestamp: number;
}

export interface MiniChatContext {
    miniChatMessages: Array<{ role: 'user' | 'ai'; text: string }>;
    nodeLabel: string;
    suggestedPrompt: string;
}

export interface FullChatState {
    isOpen: boolean;
    messages: FullChatMessage[];
    pendingContext: MiniChatContext | null;
}

export interface FullChatActions {
    openFullChat: () => void;
    closeFullChat: () => void;
    toggleFullChat: () => void;
    sendMessage: (text: string) => void;
    receiveFromMiniChat: (context: MiniChatContext) => void;
    clearPendingContext: () => void;
}

export type FullChatContextValue = FullChatState & FullChatActions;
