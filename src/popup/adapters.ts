/**
 * Document Viewer Adapter - Stub Interfaces
 * 
 * These interfaces define how popups will interact with
 * the document viewer in the future. For now, they're stubs
 * that log to console.
 * 
 * Future integration:
 * - Node popup can auto-scroll to relevant document section
 * - Mini chatbar can highlight text ranges
 * - Clicking references in chat scrolls document
 */

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
 * Stub Implementation
 * 
 * Replace this with real implementation when document viewer exists.
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

/**
 * Future: Full Chatbar Expansion
 * 
 * The mini chatbar can expand into a full chatbar.
 * This interface defines the expansion contract.
 */
export interface ChatbarExpansionAdapter {
    /** Expand mini chatbar to full chatbar */
    expandToFull(): void;

    /** Collapse full chatbar to mini */
    collapseToMini(): void;

    /** Check current state */
    isExpanded(): boolean;
}

/**
 * Stub Implementation
 */
export const chatbarExpansionStub: ChatbarExpansionAdapter = {
    expandToFull: () => {
        console.log('[Chatbar Expansion Stub] expandToFull');
    },

    collapseToMini: () => {
        console.log('[Chatbar Expansion Stub] collapseToMini');
    },

    isExpanded: () => {
        console.log('[Chatbar Expansion Stub] isExpanded');
        return false;
    },
};
