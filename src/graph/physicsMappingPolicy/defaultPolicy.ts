/**
 * Default Physics Mapping Policy
 *
 * Deterministic implementation of PhysicsMappingPolicy.
 * STEP 8 - RUN 2
 */

import type {
    PhysicsMappingPolicy,
    EdgeTypeParams
} from './policyTypes';
import { DEFAULT_EDGE_TYPE_POLICY_INTERNAL, PARAM_CLAMP } from './policyTypes';
import { isFinite as _isFinite } from './numberUtils';

/**
 * Default physics mapping policy.
 *
 * Behavior:
 * - All edge types map to springs (no filtering)
 * - Falls back to global config for unspecified params
 * - Clamps params to sane ranges
 * - Unknown edge types use wildcard ('*') policy
 */
export const DefaultPhysicsMappingPolicy: PhysicsMappingPolicy = {
    name: 'default',
    version: '1.0.0',

    mapLinkParams(link, globalConfig) {
        // Get edge type (kind), fallback to 'relates'
        const edgeType = (link.kind || 'relates').trim();
        const policy = getEdgeTypePolicy(edgeType);

        // Compute rest length
        const restLength = computeRestLength(policy, globalConfig.targetSpacing);

        // Compute compliance (inverse stiffness)
        const compliance = computeCompliance(policy, globalConfig.xpbdLinkCompliance);

        // Compute damping scale
        const dampingScale = computeDampingScale(policy, globalConfig.damping);

        // Validate params
        if (!_isFinite(restLength) || !_isFinite(compliance) || !_isFinite(dampingScale)) {
            if (import.meta.env.DEV) {
                console.warn(
                    `[PhysicsMappingPolicy] Invalid params for link ${link.id}: ` +
                    `restLength=${restLength}, compliance=${compliance}, dampingScale=${dampingScale}`
                );
            }
            return undefined;
        }

        return {
            restLength,
            compliance,
            dampingScale,
            meta: {
                edgeType,
                policyName: this.name,
                policyVersion: this.version
            }
        };
    }
};

/**
 * Export policy configuration for external use.
 */
export { DEFAULT_EDGE_TYPE_POLICY_INTERNAL as DEFAULT_EDGE_TYPE_POLICY } from './policyTypes';

/**
 * Export param clamp ranges for validation.
 */
export { PARAM_CLAMP } from './policyTypes';

/**
 * Get policy for an edge type, with wildcard fallback.
 */
function getEdgeTypePolicy(edgeType: string): EdgeTypeParams {
    return DEFAULT_EDGE_TYPE_POLICY_INTERNAL[edgeType] || DEFAULT_EDGE_TYPE_POLICY_INTERNAL['*'];
}

/**
 * Compute rest length from policy.
 */
function computeRestLength(
    policy: EdgeTypeParams,
    globalTargetSpacing: number
): number {
    const restLengthPolicy = policy.restLengthPolicy || 'inherit';

    switch (restLengthPolicy) {
        case 'fixed':
            const fixed = policy.restLengthPixels ?? globalTargetSpacing;
            return clamp(fixed, PARAM_CLAMP.restLength.min, PARAM_CLAMP.restLength.max);

        case 'scale':
            const scale = policy.restLengthScale ?? 1.0;
            const scaled = globalTargetSpacing * clamp(scale, PARAM_CLAMP.restLengthScale.min, PARAM_CLAMP.restLengthScale.max);
            return clamp(scaled, PARAM_CLAMP.restLength.min, PARAM_CLAMP.restLength.max);

        case 'inherit':
        default:
            return clamp(globalTargetSpacing, PARAM_CLAMP.restLength.min, PARAM_CLAMP.restLength.max);
    }
}

/**
 * Compute compliance from policy.
 */
function computeCompliance(
    policy: EdgeTypeParams,
    globalCompliance?: number
): number {
    const policyCompliance = policy.compliance;
    const globalValue = globalCompliance ?? 0.01; // Default from physics config

    if (policyCompliance !== undefined) {
        return clamp(policyCompliance, PARAM_CLAMP.compliance.min, PARAM_CLAMP.compliance.max);
    }

    return clamp(globalValue, PARAM_CLAMP.compliance.min, PARAM_CLAMP.compliance.max);
}

/**
 * Compute damping scale from policy.
 */
function computeDampingScale(
    policy: EdgeTypeParams,
    _globalDamping?: number
): number {
    const policyScale = policy.dampingScale;
    void _globalDamping; // Intentionally unused (future use)

    if (policyScale !== undefined) {
        return clamp(policyScale, PARAM_CLAMP.dampingScale.min, PARAM_CLAMP.dampingScale.max);
    }

    return 1.0; // Default: use global damping as-is
}

/**
 * Clamp a number to min/max range.
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
