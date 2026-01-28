/**
 * Document parsing types
 * Unified type definitions for the document parsing pipeline
 */

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
    previewOpen: boolean;
    aiActivity: boolean;           // True while AI is generating labels
    inferredTitle?: string | null;
}
