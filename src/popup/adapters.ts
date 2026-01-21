/**
 * Document Viewer Adapter - Real Implementation
 * 
 * These interfaces define how popups interact with
 * the document viewer.
 * 
 * Integration points:
 * - Node popup can auto-scroll to relevant document section
 * - Mini chatbar can highlight text ranges
 * - Clicking references in chat scrolls document
 */

import type { DocumentContextValue } from '../store/documentStore';

export interface DocumentViewerAdapter {
    /** Scroll to character offset in document */
    scrollToPosition(charOffset: number): void;

    /** Highlight text range */
    highlightRange(start: number, end: number): void;

    /** Clear all highlights */
    clearHighlight(): void;

    /** Get current scroll position */
    getCurrentPosition(): number;

    /** Check if viewer is visible */
    isVisible(): boolean;
}

/**
 * Create real document viewer adapter
 */
export function createDocumentViewerAdapter(
    documentContext: DocumentContextValue
): DocumentViewerAdapter {
    return {
        scrollToPosition: (charOffset: number) => {
            // Open viewer if in peek mode
            if (documentContext.state.viewerMode === 'peek') {
                documentContext.setViewerMode('open');
            }

            // Set highlight at position (single character)
            documentContext.setHighlights([{
                start: charOffset,
                end: charOffset + 1,
                id: 'active',
            }]);

            console.log(`[DocAdapter] Scrolled to offset ${charOffset}`);
        },

        highlightRange: (start: number, end: number) => {
            // Open viewer if in peek mode
            if (documentContext.state.viewerMode === 'peek') {
                documentContext.setViewerMode('open');
            }

            documentContext.setHighlights([{
                start,
                end,
                id: 'active',
            }]);

            console.log(`[DocAdapter] Highlighted range ${start}-${end}`);
        },

        clearHighlight: () => {
            documentContext.setHighlights([]);
            console.log('[DocAdapter] Cleared highlights');
        },

        getCurrentPosition: () => {
            // For now, return 0 (would need scroll tracking to implement fully)
            return 0;
        },

        isVisible: () => {
            return documentContext.state.viewerMode === 'open';
        },
    };
}

/**
 * Stub Implementation (deprecated - for backward compatibility)
 */
export const documentViewerStub: DocumentViewerAdapter = {
    scrollToPosition: (charOffset: number) => {
        console.log('[DocViewer Stub] scrollToPosition:', charOffset);
    },

    highlightRange: (start: number, end: number) => {
        console.log('[DocViewer Stub] highlightRange:', { start, end });
    },

    clearHighlight: () => {
        console.log('[DocViewer Stub] clearHighlight');
    },

    getCurrentPosition: () => {
        console.log('[DocViewer Stub] getCurrentPosition');
        return 0;
    },

    isVisible: () => {
        console.log('[DocViewer Stub] isVisible');
        return false;
    },
};
