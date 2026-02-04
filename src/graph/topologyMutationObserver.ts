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
 * Rejection/noop reason
 */
export type MutationReason = 'validation' | 'noop' | 'other';

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
    | 'kgSpecLoader'
    | 'topologyProvider';

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
    reason?: MutationReason;   // Why rejected/noop (validation/noop/other)
    docId?: string;            // If from KGSpec load
    providerName?: string;     // STEP7-RUN5: Provider name (e.g., 'kgSpec')
    inputHash?: string;        // STEP7-RUN5: Hash of input for observability

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

function formatDelta(before: number, after: number): string {
    const delta = after - before;
    return delta >= 0 ? `+${delta}` : `${delta}`;
}

function buildSummary(event: TopologyMutationEvent): string {
    const status = event.status === 'applied' ? 'APPLIED' : 'REJECTED';
    const version = `${event.versionBefore}->${event.versionAfter}`;
    const before = event.countsBefore;
    const after = event.countsAfter;
    const docTag = event.docId ? ` docId=${event.docId}` : '';
    const reasonTag = event.reason ? ` reason=${event.reason}` : '';
    const providerTag = event.providerName ? ` provider=${event.providerName}` : '';
    const hashTag = event.inputHash ? ` hash=${event.inputHash}` : '';
    const linkCounts = event.linkDiff
        ? ` link+${event.linkDiff.addedCount}/-${event.linkDiff.removedCount}/~${event.linkDiff.updatedCount}`
        : '';
    const springCounts = event.springDiff
        ? ` spring+${event.springDiff.addedCount}/-${event.springDiff.removedCount}`
        : '';
    const errorCount = event.validationErrors?.length || 0;
    const warningCount = event.invariantWarnings?.length || 0;
    const errorsTag = errorCount > 0 ? ` errors=${errorCount}` : '';
    const warningsTag = warningCount > 0 ? ` warnings=${warningCount}` : '';

    return `[TopologyMutation] #${event.mutationId} ${status} ${event.source}${docTag}${providerTag}${hashTag}${reasonTag} v${version} ` +
        `N/L/S ${before.nodes}/${before.directedLinks}/${before.springs} -> ${after.nodes}/${after.directedLinks}/${after.springs} ` +
        `dN=${formatDelta(before.nodes, after.nodes)} dL=${formatDelta(before.directedLinks, after.directedLinks)} dS=${formatDelta(before.springs, after.springs)}` +
        `${linkCounts}${springCounts}${errorsTag}${warningsTag}`;
}

function logMutationSummary(event: TopologyMutationEvent): void {
    const summary = buildSummary(event);
    console.groupCollapsed(summary);
    console.log({
        status: event.status,
        source: event.source,
        providerName: event.providerName,  // STEP7-RUN5
        inputHash: event.inputHash,         // STEP7-RUN5
        docId: event.docId,
        version: `${event.versionBefore}->${event.versionAfter}`,
        countsBefore: event.countsBefore,
        countsAfter: event.countsAfter,
        linkDiffCounts: event.linkDiff ? {
            added: event.linkDiff.addedCount,
            removed: event.linkDiff.removedCount,
            updated: event.linkDiff.updatedCount
        } : undefined,
        springDiffCounts: event.springDiff ? {
            added: event.springDiff.addedCount,
            removed: event.springDiff.removedCount
        } : undefined,
        validationErrors: event.validationErrors?.length || 0,
        invariantWarnings: event.invariantWarnings?.length || 0
    });
    console.groupEnd();
}

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

    logMutationSummary(event);

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
