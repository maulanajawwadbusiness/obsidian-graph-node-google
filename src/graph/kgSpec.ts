/**
 * Knowledge Graph Spec (KGSpec) Types
 * 
 * Defines the input format for parser/AI-generated knowledge graphs.
 * This is the canonical format that gets converted to Topology.
 */

/**
 * Spec version identifier.
 * Format: "kg/{major}.{minor}" or "kg/{major}" for minor=0
 */
export type KGSpecVersion = 'kg/1';

/**
 * Node in the knowledge graph.
 * Represents a concept, entity, or point in the semantic network.
 */
export interface KGNode {
    /** Unique identifier within this spec */
    id: string;

    /** Human-readable label (optional, defaults to id) */
    label?: string;

    /** Semantic type/category (e.g., 'concept', 'person', 'event') */
    kind?: string;

    /** Arbitrary payload data (for future use) */
    payload?: Record<string, unknown>;

    /** Source information (document ID, page, etc.) */
    source?: {
        docId?: string;
        page?: number;
        section?: string;
    };
}

/**
 * Directed link in the knowledge graph.
 * Represents a semantic relationship between two nodes.
 */
export interface KGLink {
    /** Source node ID */
    from: string;

    /** Target node ID */
    to: string;

    /** Relationship type (e.g., 'causes', 'supports', 'contradicts') */
    rel: string;

    /** Relationship strength (0-1, default 1.0) */
    weight?: number;

    /** Directionality flag (default true) */
    directed?: boolean;

    /** Arbitrary metadata */
    meta?: Record<string, unknown>;
}

/**
 * Complete knowledge graph specification.
 * This is what parser/AI outputs.
 */
export interface KGSpec {
    /** Spec version for compatibility checking */
    specVersion: KGSpecVersion;

    /** All nodes in the graph */
    nodes: KGNode[];

    /** All directed links between nodes */
    links: KGLink[];

    /** Optional: namespace for node IDs (future use) */
    namespace?: string;

    /** Optional: source document ID */
    docId?: string;

    /** Optional: provenance/generation metadata */
    provenance?: {
        generator?: string;
        timestamp?: string;
        model?: string;
    };
}

// =============================================================================
// Example KGSpec for Testing
// =============================================================================

/**
 * Example: Small knowledge graph about causality.
 * Used for testing and demonstration.
 */
export const EXAMPLE_KG_SPEC: KGSpec = {
    specVersion: 'kg/1',
    docId: 'example-001',
    nodes: [
        {
            id: 'cause1',
            label: 'Climate Change',
            kind: 'phenomenon'
        },
        {
            id: 'effect1',
            label: 'Rising Sea Levels',
            kind: 'consequence'
        },
        {
            id: 'effect2',
            label: 'Extreme Weather',
            kind: 'consequence'
        },
        {
            id: 'solution1',
            label: 'Renewable Energy',
            kind: 'intervention'
        }
    ],
    links: [
        {
            from: 'cause1',
            to: 'effect1',
            rel: 'causes',
            weight: 0.9
        },
        {
            from: 'cause1',
            to: 'effect2',
            rel: 'causes',
            weight: 0.85
        },
        {
            from: 'solution1',
            to: 'cause1',
            rel: 'mitigates',
            weight: 0.7
        }
    ],
    provenance: {
        generator: 'example',
        timestamp: '2026-02-04T00:00:00Z'
    }
};
