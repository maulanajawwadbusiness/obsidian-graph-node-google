/**
 * Document parsing types
 * Unified type definitions for the document parsing pipeline
 */

export type ViewerMode = 'peek' | 'open';
export type DocThemeMode = 'light' | 'dark';

export interface HighlightRange {
    start: number;
    end: number;
    id?: string;
}

export interface ParsedDocument {
    id: string;                    // UUID
    fileName: string;              // Original filename
    mimeType: string;              // MIME type
    sourceType: 'txt' | 'md' | 'pdf' | 'docx';
    text: string;                  // Raw extracted text
    warnings: string[];            // Parser warnings
    meta: {
        pages?: number;              // PDF only
        wordCount: number;
        charCount: number;
    };
}

export type DocumentStatus = 'idle' | 'parsing' | 'ready' | 'error';

export interface DocumentState {
    activeDocument: ParsedDocument | null;
    status: DocumentStatus;
    errorMessage: string | null;
    viewerMode: ViewerMode;        // peek: collapsed (44px), open: expanded (400px)
    docThemeMode: DocThemeMode;    // light or dark theme for viewer
    highlightRanges: HighlightRange[];  // Highlights for search results, etc.
    aiActivity: boolean;           // True while AI is generating labels
}
