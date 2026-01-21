import { createContext, useContext, useReducer, ReactNode, useRef, useEffect, type MutableRefObject } from 'react';
import type { DocumentState, DocumentStatus, ParsedDocument, ViewerMode, DocThemeMode, HighlightRange } from '../document/types';
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
    | { type: 'TOGGLE_VIEWER' }
    | { type: 'SET_VIEWER_MODE'; mode: ViewerMode }
    | { type: 'SET_DOC_THEME'; mode: DocThemeMode }
    | { type: 'SET_HIGHLIGHTS'; ranges: HighlightRange[] }
    | { type: 'CLEAR_DOCUMENT' }
    | { type: 'SET_AI_ACTIVITY'; active: boolean };

// Initial state
const initialState: DocumentState = {
    activeDocument: null,
    status: 'idle',
    errorMessage: null,
    viewerMode: 'peek',  // Always visible (organ, not modal)
    docThemeMode: 'dark',  // Default to dark (arnvoid aesthetic)
    highlightRanges: [],  // No highlights initially
    aiActivity: false,
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
            };
        case 'SET_ERROR':
            return {
                ...state,
                status: 'error',
                errorMessage: action.error,
            };
        case 'TOGGLE_VIEWER':
            const newMode = state.viewerMode === 'peek' ? 'open' : 'peek';
            console.log(`[Viewer] ${state.viewerMode} → ${newMode}`);
            return { ...state, viewerMode: newMode };
        case 'SET_VIEWER_MODE':
            if (action.mode !== state.viewerMode) {
                console.log(`[Viewer] ${state.viewerMode} → ${action.mode}`);
            }
            return { ...state, viewerMode: action.mode };
        case 'SET_DOC_THEME':
            if (action.mode !== state.docThemeMode) {
                console.log(`[DocTheme] ${state.docThemeMode} → ${action.mode}`);
            }
            return { ...state, docThemeMode: action.mode };
        case 'SET_HIGHLIGHTS':
            return { ...state, highlightRanges: action.ranges };
        case 'CLEAR_DOCUMENT':
            return { ...initialState, viewerMode: state.viewerMode };
        case 'SET_AI_ACTIVITY':
            return { ...state, aiActivity: action.active };
        default:
            return state;
    }
}

// Context value type
export interface DocumentViewerApi {
    scrollToOffset: (offset: number) => void;
}

export interface DocumentContextValue {
    state: DocumentState;
    setStatus: (status: DocumentStatus) => void;
    setDocument: (document: ParsedDocument) => void;
    setError: (error: string) => void;
    toggleViewer: () => void;
    setViewerMode: (mode: ViewerMode) => void;
    setDocTheme: (mode: DocThemeMode) => void;
    setHighlights: (ranges: HighlightRange[]) => void;
    clearDocument: () => void;
    parseFile: (file: File) => Promise<ParsedDocument | null>;
    setAIActivity: (active: boolean) => void;
    viewerApiRef: MutableRefObject<DocumentViewerApi | null>;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

// Provider
export function DocumentProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(documentReducer, initialState);
    const workerClientRef = useRef<WorkerClient | null>(null);
    const viewerApiRef = useRef<DocumentViewerApi | null>(null);

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
        toggleViewer: () => dispatch({ type: 'TOGGLE_VIEWER' }),
        setViewerMode: (mode) => dispatch({ type: 'SET_VIEWER_MODE', mode }),
        setDocTheme: (mode) => dispatch({ type: 'SET_DOC_THEME', mode }),
        setHighlights: (ranges) => dispatch({ type: 'SET_HIGHLIGHTS', ranges }),
        clearDocument: () => dispatch({ type: 'CLEAR_DOCUMENT' }),
        parseFile,
        setAIActivity: (active) => dispatch({ type: 'SET_AI_ACTIVITY', active }),
        viewerApiRef
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
