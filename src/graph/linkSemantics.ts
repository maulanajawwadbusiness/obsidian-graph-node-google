/**
 * Link Semantics Policy (Scaffolding)
 * 
 * Defines which relationship types become physics springs and their properties.
 * Currently minimal - future extension point for semantic-aware physics.
 */

/**
 * Policy: Which relationship types should create physics springs.
 * 
 * Default: All relationship types become springs.
 * Future: Could filter based on rel type, or apply different spring properties.
 */
export interface RelTypePolicy {
    /** Whether this rel type should create a spring (default true) */
    createSpring?: boolean;

    /** Optional: Override spring strength (0-1) */
    springStrength?: number;

    /** Optional: Override rest length (pixels) */
    restLength?: number;
}

/**
 * Default policy mapping.
 * All rel types are treated equally for now.
 */
export const DEFAULT_REL_POLICY: Record<string, RelTypePolicy> = {
    // Default for all unknown types
    '*': {
        createSpring: true
    }

    // Future examples:
    // 'causes': { createSpring: true, springStrength: 0.9 },
    // 'supports': { createSpring: true, springStrength: 0.7 },
    // 'contradicts': { createSpring: true, springStrength: 0.5 },
    // 'references': { createSpring: false }, // No spring for citations
};

/**
 * Get policy for a relationship type.
 * Falls back to wildcard ('*') if specific type not defined.
 */
export function getRelPolicy(relType: string): RelTypePolicy {
    return DEFAULT_REL_POLICY[relType] || DEFAULT_REL_POLICY['*'] || { createSpring: true };
}

/**
 * Check if a relationship type should create a physics spring.
 */
export function shouldCreateSpring(relType: string): boolean {
    const policy = getRelPolicy(relType);
    return policy.createSpring !== false; // Default true
}

// Future: Could be called from deriveSpringEdges() to filter links
// For now, all links become springs (phase 1)
