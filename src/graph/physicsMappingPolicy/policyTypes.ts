/**
 * Physics Mapping Policy - Type Definitions
 *
 * Deterministic policy layer for mapping knowledge edge types to physics constraints.
 * STEP 8 - RUN 2
 */

import type { DirectedLink } from '../topologyTypes';

/**
 * Per-edge-type physics parameters.
 *
 * All fields optional - falls back to default/global config if not specified.
 */
export interface EdgeTypeParams {
    /**
     * Compliance (inverse stiffness) for XPBD solver.
     * Lower = stiffer, Higher = softer.
     * Range: [0, infinity), typical: [0.001, 0.1]
     */
    compliance?: number;

    /**
     * Damping scale multiplier for this edge type.
     * 1.0 = global damping, <1.0 = less damping (more springy), >1.0 = more damping
     * Range: (0, infinity), typical: [0.5, 2.0]
     */
    dampingScale?: number;

    /**
     * Rest length policy for this edge type.
     * - 'inherit': use global targetSpacing (default)
     * - 'scale': multiply targetSpacing by restLengthScale
     * - 'fixed': use fixed restLengthPixels
     */
    restLengthPolicy?: 'inherit' | 'scale' | 'fixed';

    /**
     * Scale factor for targetSpacing when restLengthPolicy='scale'
     * Range: (0, infinity), typical: [0.5, 2.0]
     * <1.0 = shorter spring (pulls nodes closer)
     * >1.0 = longer spring (pushes nodes apart)
     */
    restLengthScale?: number;

    /**
     * Fixed rest length in pixels when restLengthPolicy='fixed'
     * Range: (0, infinity), typical: [50, 500]
     */
    restLengthPixels?: number;

    /**
     * Whether this edge type is breakable under extreme tension.
     * (Future: not implemented in solver yet)
     */
    breakable?: boolean;

    /**
     * Whether to boost repulsion between nodes connected by this edge type.
     * (Future: for cluster separation)
     */
    enableRepulsionBoost?: boolean;
}

/**
 * Policy configuration mapping edge types to physics parameters.
 *
 * Use '*' as wildcard for unknown edge types.
 */
export type EdgeTypePolicyMap = Record<string, EdgeTypeParams>;

/**
 * Physics mapping policy interface.
 *
 * Implementations must be deterministic: same input produces same output.
 */
export interface PhysicsMappingPolicy {
    /** Policy name/version for observability */
    readonly name: string;
    readonly version: string;

    /**
     * Map a directed link to physics spring parameters.
     *
     * @param link The directed knowledge link
     * @param globalConfig Global physics config (for fallback values)
     * @returns Spring parameters, or undefined to skip creating a spring
     */
    mapLinkParams(
        link: DirectedLink,
        globalConfig: { targetSpacing: number; xpbdLinkCompliance?: number; damping?: number }
    ): LinkPhysicsParams | undefined;
}

/**
 * Spring parameters output by policy.
 *
 * These are applied to SpringEdge before conversion to PhysicsLink.
 */
export interface LinkPhysicsParams {
    /** Rest length in pixels (required) */
    restLength: number;

    /** Compliance (inverse stiffness) for XPBD */
    compliance: number;

    /** Damping scale multiplier (1.0 = global) */
    dampingScale: number;

    /** Optional metadata for traceability */
    meta?: {
        edgeType: string;
        policyName: string;
        policyVersion: string;
    };
}

/**
 * Default policy configuration.
 *
 * Maps common edge types to physics parameters.
 *
 * NOTE: This is re-exported from defaultPolicy.ts for module cohesion.
 */
export const DEFAULT_EDGE_TYPE_POLICY_INTERNAL: EdgeTypePolicyMap = {
    // Wildcard fallback for unknown types
    '*': {
        compliance: undefined, // Use global xpbdLinkCompliance
        restLengthPolicy: 'inherit',
        dampingScale: 1.0
    },

    // Future examples (commented out for baseline behavior):
    // 'causes': {
    //     compliance: 0.005,  // Stiffer than default
    //     restLengthPolicy: 'scale',
    //     restLengthScale: 0.8,  // Shorter rest length
    //     dampingScale: 1.2
    // },
    // 'supports': {
    //     compliance: 0.02,  // Softer than default
    //     restLengthPolicy: 'scale',
    //     restLengthScale: 1.2,  // Longer rest length
    //     dampingScale: 0.8
    // },
    // 'references': {
    //     compliance: 0.05,  // Very soft (weak citation links)
    //     restLengthPolicy: 'scale',
    //     restLengthScale: 1.5,
    //     dampingScale: 1.5
    // }
};

/**
 * Sane parameter clamp ranges.
 */
export const PARAM_CLAMP = {
    compliance: { min: 0.0001, max: 1.0 },
    dampingScale: { min: 0.1, max: 5.0 },
    restLength: { min: 20, max: 2000 },
    restLengthScale: { min: 0.1, max: 5.0 }
} as const;
