/**
 * Topology Provider Types
 *
 * Defines the provider interface for deterministic topology generation.
 */

import type { Topology, DirectedLink, NodeSpec } from '../topologyTypes';

/**
 * Provider metadata (included in mutation events)
 */
export interface ProviderMetadata {
    /** Provider name (e.g., 'kgSpec', 'manualPatch') */
    provider: string;
    /** Optional document identifier */
    docId?: string;
    /** Stable hash of input for observability */
    inputHash: string;
}

/**
 * Snapshot build result
 */
export interface TopologySnapshot {
    nodes: NodeSpec[];
    directedLinks: DirectedLink[];
    /** Optional provider metadata */
    meta?: ProviderMetadata;
}

/**
 * Patch build result
 */
export interface TopologyPatchSpec {
    addNodes?: NodeSpec[];
    removeNodes?: string[];
    addLinks?: DirectedLink[];
    removeLinkIds?: string[];
    removeLinks?: Array<{ id?: string; from?: string; to?: string }>;
    setLinks?: DirectedLink[];
}

/**
 * Topology Provider Interface
 *
 * A provider produces topology snapshots/patches deterministically
 * from a given input.
 *
 * @template TInput The input type (e.g., KGSpec, manual mutation spec)
 */
export interface TopologyProvider<TInput = unknown> {
    /** Provider name (must be stable) */
    readonly name: string;

    /**
     * Build a complete topology snapshot from input.
     * Output must be deterministic for the same input.
     */
    buildSnapshot(input: TInput): TopologySnapshot;

    /**
     * Build a topology patch from input (optional).
     * Only needed for incremental update providers.
     */
    buildPatch?(prev: Topology, input: TInput): TopologyPatchSpec;

    /**
     * Compute a stable hash of the input (for observability).
     * If not provided, a default JSON string hash will be used.
     */
    hashInput?(input: TInput): string;
}

/**
 * Provider application result
 */
export interface ProviderApplyResult {
    /** Whether the topology was changed */
    changed: boolean;
    /** Whether the application was rejected (validation failure) */
    rejected: boolean;
    /** Rejection reason (if rejected) */
    rejectionReason?: string;
    /** New topology version (if applied) */
    version?: number;
}

/**
 * Provider registry entry
 */
export interface ProviderRegistryEntry {
    provider: TopologyProvider;
    schemaVersion?: string;
    description?: string;
}
