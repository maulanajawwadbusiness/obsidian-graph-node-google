/**
 * Physics Mapping Policy - Barrel Exports
 *
 * STEP 8 - RUN 2
 */

export type {
    PhysicsMappingPolicy,
    LinkPhysicsParams,
    EdgeTypeParams,
    EdgeTypePolicyMap
} from './policyTypes';

export {
    DefaultPhysicsMappingPolicy,
    DEFAULT_EDGE_TYPE_POLICY,
    PARAM_CLAMP
} from './defaultPolicy';

export {
    isFinite,
    clamp,
    safeDivide,
    inRange
} from './numberUtils';
