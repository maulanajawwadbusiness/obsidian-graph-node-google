import { createContext, useContext, useReducer, ReactNode, useRef, useEffect } from 'react';
import type { DocumentState, DocumentStatus, ParsedDocument } from '../document/types';
import { WorkerClient } from '../document/workerClient';

/**
 * Document Store - React Context for managing parsed document state
 * Follows the existing simple state management pattern in the codebase
 */

// Actions
type DocumentAction =
    | { type: 'SET_STATUS'; status: DocumentStatus }
    | { type: 'SET_DOCUMENT'; document: ParsedDocument }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'TOGGLE_PREVIEW' }
    | { type: 'SET_PREVIEW'; open: boolean }
    | { type: 'CLEAR_DOCUMENT' }
    | { type: 'SET_AI_ACTIVITY'; active: boolean }
    | { type: 'SET_AI_ERROR'; error: string | null }
    | { type: 'SET_INFERRED_TITLE'; title: string | null };

// Initial state
const initialState: DocumentState = {
    activeDocument: null,
    status: 'idle',
    errorMessage: null,
    previewOpen: false,
    aiActivity: false,
    aiErrorMessage: null,
    inferredTitle: null,
};

// Reducer
function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
    switch (action.type) {
        case 'SET_STATUS':
            return { ...state, status: action.status };
        case 'SET_DOCUMENT':
            return {
                ...state,
                activeDocument: action.document,
                status: 'ready',
                errorMessage: null,
                inferredTitle: null, // Reset on new document (will be filled by AI later)
            };
        case 'SET_ERROR':
            return {
                ...state,
                status: 'error',
                errorMessage: action.error,
            };
        case 'TOGGLE_PREVIEW':
            return { ...state, previewOpen: !state.previewOpen };
        case 'SET_PREVIEW':
            return { ...state, previewOpen: action.open };
        case 'CLEAR_DOCUMENT':
            return { ...initialState, previewOpen: state.previewOpen };
        case 'SET_AI_ACTIVITY':
            return { ...state, aiActivity: action.active };
        case 'SET_AI_ERROR':
            return { ...state, aiErrorMessage: action.error };
        case 'SET_INFERRED_TITLE':
            return { ...state, inferredTitle: action.title };
        default:
            return state;
    }
}

// Context value type
interface DocumentContextValue {
    state: DocumentState;
    setStatus: (status: DocumentStatus) => void;
    setDocument: (document: ParsedDocument) => void;
    setError: (error: string) => void;
    togglePreview: () => void;
    setPreviewOpen: (open: boolean) => void;
    clearDocument: () => void;
    parseFile: (file: File) => Promise<ParsedDocument | null>;
    setAIActivity: (active: boolean) => void;
    setAIError: (error: string | null) => void;
    setInferredTitle: (title: string | null) => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

// Provider
export function DocumentProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(documentReducer, initialState);
    const workerClientRef = useRef<WorkerClient | null>(null);

    // Initialize worker on mount
    useEffect(() => {
        workerClientRef.current = new WorkerClient();
        return () => {
            workerClientRef.current?.terminate();
        };
    }, []);

    const parseFile = async (file: File): Promise<ParsedDocument | null> => {
        if (!workerClientRef.current) {
            dispatch({ type: 'SET_ERROR', error: 'Worker not initialized' });
            return null;
        }

        try {
            dispatch({ type: 'SET_STATUS', status: 'parsing' });
            console.log('[DocumentStore] Starting parse:', file.name);

            const document = await workerClientRef.current.parseFile(file);

            console.log('[DocumentStore] Parse complete:', document.fileName, document.meta.wordCount, 'words');
            dispatch({ type: 'SET_DOCUMENT', document });

            // Return document for immediate use (state update is async)
            return document;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
            console.error('[DocumentStore] Parse error:', errorMessage);
            dispatch({ type: 'SET_ERROR', error: errorMessage });
            return null;
        }
    };

    const contextValue: DocumentContextValue = {
        state,
        setStatus: (status) => dispatch({ type: 'SET_STATUS', status }),
        setDocument: (document) => dispatch({ type: 'SET_DOCUMENT', document }),
        setError: (error) => dispatch({ type: 'SET_ERROR', error }),
        togglePreview: () => dispatch({ type: 'TOGGLE_PREVIEW' }),
        setPreviewOpen: (open) => dispatch({ type: 'SET_PREVIEW', open }),
        clearDocument: () => dispatch({ type: 'CLEAR_DOCUMENT' }),
        parseFile,
        setAIActivity: (active) => dispatch({ type: 'SET_AI_ACTIVITY', active }),
        setAIError: (error) => dispatch({ type: 'SET_AI_ERROR', error }),
        setInferredTitle: (title) => dispatch({ type: 'SET_INFERRED_TITLE', title })
    };

    return (
        <DocumentContext.Provider value={contextValue}>
            {children}
        </DocumentContext.Provider>
    );
}

// Hook
export function useDocument(): DocumentContextValue {
    const context = useContext(DocumentContext);
    if (!context) {
        throw new Error('useDocument must be used within DocumentProvider');
    }
    return context;
}
