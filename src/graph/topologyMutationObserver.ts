/**
 * Topology Mutation Observer
 * 
 * DEV-ONLY: Tracks topology mutations for debugging and trust.
 * Provides structured event records with before/after state, diffs, and validation results.
 * 
 * CRITICAL SAFEGUARD: This module should NEVER be bundled in production.
 */

if (!import.meta.env.DEV) {
    throw new Error('[SECURITY] topologyMutationObserver loaded in production build - CHECK IMPORTS');
}

/**
 * Mutation event status
 */
export type MutationStatus = 'applied' | 'rejected';

/**
 * Mutation source/reason
 */
export type MutationSource =
    | 'setTopology'
    | 'patchTopology'
    | 'addKnowledgeLink'
    | 'removeKnowledgeLink'
    | 'updateKnowledgeLink'
    | 'clearTopology'
    | 'kgSpecLoader';

/**
 * Diff summary for directed links
 */
export interface LinkDiff {
    added: string[];      // Link IDs added (truncated to first 10)
    removed: string[];    // Link IDs removed (truncated to first 10)
    updated: string[];    // Link IDs updated (same ID, different fields)
    addedCount: number;   // Total count
    removedCount: number; // Total count
    updatedCount: number; // Total count
}

/**
 * Diff summary for springs
 */
export interface SpringDiff {
    added: string[];      // Canonical keys added (truncated to first 10)
    removed: string[];    // Canonical keys removed (truncated to first 10)
    addedCount: number;   // Total count
    removedCount: number; // Total count
}

/**
 * Topology counts snapshot
 */
export interface TopologyCounts {
    nodes: number;
    directedLinks: number;
    springs: number;
}

/**
 * Mutation event record
 */
export interface TopologyMutationEvent {
    // Identity
    mutationId: number;        // Monotonic counter
    timestamp: number;         // Date.now()

    // Status
    status: MutationStatus;
    source: MutationSource;
    docId?: string;            // If from KGSpec load

    // Version tracking
    versionBefore: number;
    versionAfter: number;      // Same as versionBefore if rejected

    // Counts
    countsBefore: TopologyCounts;
    countsAfter: TopologyCounts;  // Same as countsBefore if rejected

    // Diff (only for applied mutations)
    linkDiff?: LinkDiff;
    springDiff?: SpringDiff;

    // Validation/Invariants
    validationErrors?: string[];   // If rejected
    invariantWarnings?: string[];  // If applied but dev-invariants failed
}

/**
 * Mutation observer callback
 */
export type MutationObserverCallback = (event: TopologyMutationEvent) => void;

/**
 * Internal state
 */
let mutationIdCounter = 0;
const mutationHistory: TopologyMutationEvent[] = [];
const MAX_HISTORY_SIZE = 200;
const observers: Set<MutationObserverCallback> = new Set();

/**
 * Emit a mutation event.
 * Adds to history ring buffer and notifies observers.
 */
export function emitMutationEvent(event: TopologyMutationEvent): void {
    // Assign monotonic ID
    event.mutationId = ++mutationIdCounter;
    event.timestamp = Date.now();

    // Add to ring buffer
    mutationHistory.push(event);
    if (mutationHistory.length > MAX_HISTORY_SIZE) {
        mutationHistory.shift(); // Remove oldest
    }

    // Notify observers
    observers.forEach(cb => {
        try {
            cb(event);
        } catch (err) {
            console.error('[MutationObserver] Observer callback error:', err);
        }
    });
}

/**
 * Get mutation history (last N events).
 * @param limit Max number of events to return (default: all)
 */
export function getMutationHistory(limit?: number): TopologyMutationEvent[] {
    if (limit === undefined) {
        return [...mutationHistory];
    }
    return mutationHistory.slice(-limit);
}

/**
 * Get the last mutation event.
 * @param verbose If true, return full event; otherwise return summary
 */
export function getLastMutation(verbose?: boolean): TopologyMutationEvent | null {
    if (mutationHistory.length === 0) {
        return null;
    }
    const last = mutationHistory[mutationHistory.length - 1];
    if (!verbose) {
        // Return summary (omit full diffs)
        const { linkDiff, springDiff, ...summary } = last;
        return {
            ...summary,
            linkDiff: linkDiff ? {
                addedCount: linkDiff.addedCount,
                removedCount: linkDiff.removedCount,
                updatedCount: linkDiff.updatedCount,
                added: [],
                removed: [],
                updated: []
            } : undefined,
            springDiff: springDiff ? {
                addedCount: springDiff.addedCount,
                removedCount: springDiff.removedCount,
                added: [],
                removed: []
            } : undefined
        };
    }
    return last;
}

/**
 * Clear mutation history.
 */
export function clearMutationHistory(): void {
    mutationHistory.length = 0;
    console.log('[MutationObserver] History cleared');
}

/**
 * Subscribe to mutation events.
 * @param callback Observer callback
 * @returns Unsubscribe function
 */
export function subscribeMutationObserver(callback: MutationObserverCallback): () => void {
    observers.add(callback);
    return () => {
        observers.delete(callback);
    };
}

/**
 * Get current observer count (for debugging).
 */
export function getObserverCount(): number {
    return observers.size;
}
