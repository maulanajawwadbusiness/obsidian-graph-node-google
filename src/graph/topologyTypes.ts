/**
 * First-Class Topology Types
 * 
 * This module defines the knowledge graph layer (directed links between nodes)
 * separate from the physics spring graph (undirected edges).
 */

// Unique node identifier
export type NodeId = string;

/**
 * Directed knowledge link between two nodes.
 * This represents semantic relationships (e.g., "A causes B", "A references B").
 */
export interface DirectedLink {
    from: NodeId;
    to: NodeId;
    kind?: string;          // e.g., 'causal', 'reference', 'structural'
    weight?: number;        // Semantic strength (0-1), optional
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
 * The complete knowledge graph topology.
 * This is the single source of truth for connectivity.
 */
export interface Topology {
    nodes: NodeSpec[];
    links: DirectedLink[];
}

/**
 * Undirected spring edge for physics simulation.
 * Derived from DirectedLink(s) via a transformation function.
 */
export interface SpringEdge {
    a: NodeId;              // Always min(from, to) for canonical ordering
    b: NodeId;              // Always max(from, to)
    restLen?: number;       // Rest length in pixels (optional override)
    strength?: number;      // Spring stiffness (optional override)
    meta?: {
        sourceLinks?: string[]; // IDs of DirectedLinks that created this spring
        [key: string]: unknown;
    };
}
