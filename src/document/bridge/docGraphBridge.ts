/**
 * Document-Graph Bridge
 * Manages references between graph nodes and document offsets
 */

import type { NodeDocRefV1 } from './nodeDocRef';
import type { PhysicsEngine } from '../../physics/engine';

export interface RevealOptions {
    scrollBehavior?: 'smooth' | 'instant';
    highlightPulse?: boolean;
    skipIfTyping?: boolean;  // Don't steal focus from chat input
}

export interface RevealResult {
    success: boolean;
    reason?: 'docMismatch' | 'excerptStale' | 'viewerClosed' | 'userTyping';
}

/**
 * Create document-graph bridge
 * Provides API for binding refs and revealing them in the viewer
 */
export function createDocGraphBridge(
    engine: PhysicsEngine,
    documentStore: any,  // DocumentContextValue
): {
    bindRef: (nodeId: string, ref: NodeDocRefV1) => void;
    unbindRef: (nodeId: string, refId: string) => void;
    getRefs: (nodeId: string) => NodeDocRefV1[];
    getPrimaryRef: (nodeId: string) => NodeDocRefV1 | null;
    reveal: (ref: NodeDocRefV1, options?: RevealOptions) => RevealResult;
} {

    const bindRef = (nodeId: string, ref: NodeDocRefV1) => {
        const node = engine.nodes.get(nodeId);
        if (!node) return;

        if (!node.docRefs) {
            node.docRefs = [];
        }
        node.docRefs.push(ref);

        // Set as primary if it's the first ref
        if (!node.primaryDocRefId) {
            node.primaryDocRefId = ref.refId;
        }
    };

    const unbindRef = (nodeId: string, refId: string) => {
        const node = engine.nodes.get(nodeId);
        if (!node || !node.docRefs) return;

        node.docRefs = node.docRefs.filter(r => r.refId !== refId);

        if (node.primaryDocRefId === refId) {
            node.primaryDocRefId = node.docRefs[0]?.refId || undefined;
        }
    };

    const getRefs = (nodeId: string): NodeDocRefV1[] => {
        const node = engine.nodes.get(nodeId);
        return node?.docRefs || [];
    };

    const getPrimaryRef = (nodeId: string): NodeDocRefV1 | null => {
        const node = engine.nodes.get(nodeId);
        if (!node || !node.primaryDocRefId) return null;

        return node.docRefs?.find(r => r.refId === node.primaryDocRefId) || null;
    };

    const reveal = (ref: NodeDocRefV1, options: RevealOptions = {}): RevealResult => {
        const { skipIfTyping = true, scrollBehavior = 'smooth', highlightPulse = true } = options;

        // Check if document matches
        if (documentStore.state.activeDocument?.id !== ref.docId) {
            return { success: false, reason: 'docMismatch' };
        }

        // Open viewer if in peek mode
        if (documentStore.state.viewerMode === 'peek') {
            documentStore.setViewerMode('open');
        }

        // Set highlights with pulse
        if (highlightPulse) {
            documentStore.setHighlights([{
                start: ref.range.start,
                end: ref.range.end,
                id: 'active',
            }]);
        }

        console.log(`[Reveal] node ref @ offset ${ref.range.start} result=success`);

        return { success: true };
    };

    return {
        bindRef,
        unbindRef,
        getRefs,
        getPrimaryRef,
        reveal,
    };
}
