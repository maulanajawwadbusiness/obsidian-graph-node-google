import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import type { PopupState, PopupContextValue, AnchorGeometry, PopupRect } from './popupTypes';
import { generateResponseAsync } from '../fullchat/fullChatAi';

/**
 * Popup Store - React Context for managing popup state
 */

const initialState: PopupState = {
    isOpen: false,
    mode: 'normal',
    selectedNodeId: null,
    lastClickedNodeId: null,
    lastClickedNodeLabel: null,
    anchorGeometry: null,
    popupRect: null,
    chatbarOpen: false,
    messages: [],
};

const PopupContext = createContext<PopupContextValue | null>(null);

export function PopupProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PopupState>(initialState);

    const openPopup = (nodeId: string, geometry: AnchorGeometry, content?: { title: string; summary: string }) => {
        console.log('[Popup] Opening for node:', nodeId);
        setState({
            isOpen: true,
            mode: 'normal',
            selectedNodeId: nodeId,
            lastClickedNodeId: nodeId,
            lastClickedNodeLabel: null,  // Label will be looked up by consumers from engine
            anchorGeometry: geometry,
            popupRect: null,
            chatbarOpen: false,
            messages: [],
            content: content || null
        });
    };

    const closePopup = () => {
        console.log('[Popup] Closing');
        // Preserve lastClickedNodeId after popup closes
        setState(prev => ({
            ...initialState,
            lastClickedNodeId: prev.selectedNodeId,
            lastClickedNodeLabel: prev.lastClickedNodeLabel,
        }));
    };

    const switchToNode = (nodeId: string, geometry: AnchorGeometry) => {
        console.log('[Popup] Switching to node:', nodeId);
        setState({
            ...state,
            selectedNodeId: nodeId,
            anchorGeometry: geometry,
        });
    };

    // AI Controller Ref
    const aiAbortController = useRef<AbortController | null>(null);

    // Import generator (assume it's available from fullChatAi or similar path)
    // We need to import generateResponseAsync at top of file. 
    // Since I can't add imports with this tool easily without replacing whole file or top chunk, 
    // I will assume the import is added in a separate step or I'll use a multi-replace if strictly needed.
    // Wait, I should add the import first. I'll do that in a separate tool call to be safe.

    const sendMessage = (text: string) => {
        console.log('[MiniChatAI] send_start', { nodeId: state.selectedNodeId, text });

        // 1. Abort previous
        if (aiAbortController.current) {
            aiAbortController.current.abort();
            console.log('[MiniChatAI] aborted previous');
        }
        aiAbortController.current = new AbortController();
        const signal = aiAbortController.current.signal;

        const userMessage = { role: 'user' as const, text };
        const aiMessage = { role: 'ai' as const, text: '' }; // Pending

        setState(prev => ({
            ...prev,
            chatbarOpen: true,
            messages: [...prev.messages, userMessage, aiMessage],
        }));

        // 2. Build Context
        const context = {
            nodeLabel: state.selectedNodeId || 'Unknown Node',
            documentText: null, // MiniChat focuses on Node Summary, not full doc text (optimization)
            documentTitle: state.content?.title || null,
            recentHistory: [], // could pass history if needed
        };

        // 3. Run AI Loop
        (async () => {
            try {
                // Construct specialized prompt for MiniChat
                let prompt = text;
                if (state.content) {
                    prompt = `Context:
Title: "${state.content.title}"
Summary: "${state.content.summary}"

User Question: ${text}`;
                }

                console.log('[MiniChatAI] context title=', state.content?.title);

                const generator = generateResponseAsync(prompt, context as any, signal);

                let accum = '';
                for await (const chunk of generator) {
                    if (signal.aborted) break;
                    accum += chunk;

                    // Update UI (throttled by React state, but good enough for 60fps feel usually)
                    setState(prev => {
                        const msgs = [...prev.messages];
                        const last = msgs[msgs.length - 1];
                        if (last && last.role === 'ai') {
                            last.text = accum;
                        }
                        return { ...prev, messages: msgs };
                    });
                }
                console.log(`[MiniChatAI] ok chars=${accum.length}`);

            } catch (err) {
                if (signal.aborted) return;
                console.error('[MiniChatAI] error', err);

                // Fallback / Error state
                setState(prev => {
                    const msgs = [...prev.messages];
                    const last = msgs[msgs.length - 1];
                    if (last && last.role === 'ai') {
                        last.text += '\n[Connection Error]';
                    }
                    return { ...prev, messages: msgs };
                });
            }
        })();
    };

    const closeChatbar = () => {
        console.log('[Popup] Closing chatbar');
        setState({
            ...state,
            chatbarOpen: false,
        });
    };

    const setPopupRect = (rect: PopupRect | null) => {
        setState(prev => ({ ...prev, popupRect: rect }));
    };

    const contextValue: PopupContextValue = {
        ...state,
        openPopup,
        closePopup,
        switchToNode,
        sendMessage,
        closeChatbar,
        setPopupRect,
    };

    return (
        <PopupContext.Provider value={contextValue}>
            {children}
        </PopupContext.Provider>
    );
}

export function usePopup(): PopupContextValue {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error('usePopup must be used within PopupProvider');
    }
    return context;
}
