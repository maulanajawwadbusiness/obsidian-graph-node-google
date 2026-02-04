/**
 * First-Class Topology Types
 * 
 * This module defines the knowledge graph layer (directed links between nodes)
 * separate from the physics spring graph (undirected edges).
 */

// Unique node identifier
export type NodeId = string;

/**
 * Directed knowledge link (A→B).
 * Preserves semantic direction - A→B and B→A are distinct.
 * 
 * STEP4-RUN3: Added `id` field for stable addressing.
 * - Allows parallel edges (multiple A→B with different rel/meta)
 * - Never uses endpoint sorting for identity
 * - If missing, generated at load time
 */
export interface DirectedLink {
    id?: string;        // STEP4-RUN3: Unique identifier (never sorts endpoints)
    from: NodeId;
    to: NodeId;
    kind?: string;      // Relationship type (e.g., 'causes', 'supports')
    weight?: number;    // Semantic strength (0-1), optional
    meta?: Record<string, unknown>; // Extensible metadata
}

/**
 * Node specification for topology.
 * Minimal info needed to define a node's existence and identity.
 */
export interface NodeSpec {
    id: NodeId;
    label?: string;
    meta?: Record<string, unknown>;
}

/**
 * Complete topology (knowledge graph + derived physics).
 * 
 * STEP3: Separated directed knowledge from undirected physics.
 * - `links`: Directed knowledge edges (A→B and B→A are distinct)
 * - `springs`: Undirected physics springs (derived from links, deduplicated)
 */
export interface Topology {
    nodes: NodeSpec[];

    /** Directed knowledge links (preserves semantic direction) */
    links: DirectedLink[];

    /** Undirected physics springs (derived from links, one per {A,B} pair) */
    springs?: SpringEdge[];
}

/**
 * STEP3-RUN2: Undirected physics spring edge.
 * Derived from directed knowledge links via deduplication.
 * 
 * STEP4-RUN7: Added `contributors` for provenance tracking.
 */
export interface SpringEdge {
}
