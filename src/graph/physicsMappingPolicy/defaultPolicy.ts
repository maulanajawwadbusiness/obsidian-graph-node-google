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
 * STEP 8 - RUN 13: Added validation for unknown types and invalid ranges.
 */
export const DefaultPhysicsMappingPolicy: PhysicsMappingPolicy = {
    name: 'default',
    version: '1.0.0',

    mapLinkParams(link, globalConfig) {
        // Get edge type (kind), fallback to 'relates'
        const edgeType = (link.kind || 'relates').trim();
        const policy = getEdgeTypePolicy(edgeType);

        // STEP 8 - RUN 13: Warn once for unknown edge types
        if (import.meta.env.DEV && !isKnownEdgeType(edgeType) && edgeType !== 'relates') {
            warnUnknownEdgeType(edgeType);
        }

        // Compute rest length
        const restLength = computeRestLength(policy, globalConfig.targetSpacing);

        // Compute compliance (inverse stiffness)
        const compliance = computeCompliance(policy, globalConfig.xpbdLinkCompliance);

        // Compute damping scale
        const dampingScale = computeDampingScale(policy, globalConfig.damping);

        // STEP 8 - RUN 13: Enhanced validation with range warnings
        if (!_isFinite(restLength) || !_isFinite(compliance) || !_isFinite(dampingScale)) {
            if (import.meta.env.DEV) {
                console.error(
                    `[PhysicsMappingPolicy] Invalid params (NaN/Infinity) for link ${link.id}: ` +
                    `edgeType=${edgeType}, restLength=${restLength}, compliance=${compliance}, ` +
                    `dampingScale=${dampingScale}`
                );
            }
            return undefined;
        }

        // Warn if params were clamped to valid range
        if (import.meta.env.DEV) {
            validateParamRanges(edgeType, policy, restLength, compliance, dampingScale);
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

/**
 * STEP 8 - RUN 13: Track warned unknown edge types to avoid spam.
 */
const warnedUnknownTypes = new Set<string>();

/**
 * Check if an edge type has a specific policy (not wildcard).
 */
function isKnownEdgeType(edgeType: string): boolean {
    return DEFAULT_EDGE_TYPE_POLICY_INTERNAL.hasOwnProperty(edgeType);
}

/**
 * Warn once per unknown edge type.
 */
function warnUnknownEdgeType(edgeType: string): void {
    if (!warnedUnknownTypes.has(edgeType)) {
        warnedUnknownTypes.add(edgeType);
        console.warn(
            `[PhysicsMappingPolicy] Unknown edge type '${edgeType}' - using wildcard '*' policy. ` +
            `Add to DEFAULT_EDGE_TYPE_POLICY for type-specific params.`
        );
    }
}

/**
 * STEP 8 - RUN 13: Validate parameter ranges and warn if clamped.
 */
function validateParamRanges(
    edgeType: string,
    policy: EdgeTypeParams,
    _restLength: number,
    _compliance: number,
    _dampingScale: number
): void {
    const warnings: string[] = [];

    // Check compliance range
    if (policy.compliance !== undefined) {
        if (policy.compliance < PARAM_CLAMP.compliance.min) {
            warnings.push(`compliance ${policy.compliance} clamped to ${PARAM_CLAMP.compliance.min}`);
        } else if (policy.compliance > PARAM_CLAMP.compliance.max) {
            warnings.push(`compliance ${policy.compliance} clamped to ${PARAM_CLAMP.compliance.max}`);
        }
    }

    // Check restLengthScale range
    if (policy.restLengthScale !== undefined) {
        if (policy.restLengthScale < PARAM_CLAMP.restLengthScale.min) {
            warnings.push(`restLengthScale ${policy.restLengthScale} clamped to ${PARAM_CLAMP.restLengthScale.min}`);
        } else if (policy.restLengthScale > PARAM_CLAMP.restLengthScale.max) {
            warnings.push(`restLengthScale ${policy.restLengthScale} clamped to ${PARAM_CLAMP.restLengthScale.max}`);
        }
    }

    // Check dampingScale range
    if (policy.dampingScale !== undefined) {
        if (policy.dampingScale < PARAM_CLAMP.dampingScale.min) {
            warnings.push(`dampingScale ${policy.dampingScale} clamped to ${PARAM_CLAMP.dampingScale.min}`);
        } else if (policy.dampingScale > PARAM_CLAMP.dampingScale.max) {
            warnings.push(`dampingScale ${policy.dampingScale} clamped to ${PARAM_CLAMP.dampingScale.max}`);
        }
    }

    // Check restLengthPixels range
    if (policy.restLengthPixels !== undefined) {
        if (policy.restLengthPixels < PARAM_CLAMP.restLength.min) {
            warnings.push(`restLengthPixels ${policy.restLengthPixels} clamped to ${PARAM_CLAMP.restLength.min}`);
        } else if (policy.restLengthPixels > PARAM_CLAMP.restLength.max) {
            warnings.push(`restLengthPixels ${policy.restLengthPixels} clamped to ${PARAM_CLAMP.restLength.max}`);
        }
    }

    // Log warnings if any
    if (warnings.length > 0) {
        console.warn(
            `[PhysicsMappingPolicy] Edge type '${edgeType}': ` +
            `params were clamped to valid ranges: ${warnings.join(', ')}`
        );
    }
}
