# Step 8 Final Report: Physics Mapping Policy

Date: 2026-02-04
Status: COMPLETE
Runs: 15
Commits: 5 (runs 1-3, 4-6, 7-9, 10-12, 13-14)

## Executive Summary

Implemented a deterministic physics mapping policy layer that maps knowledge edge types to physics constraint parameters. The same input topology produces identical physics constraints (same spring set with same restLen, compliance, damping), with type-specific parameter overrides, parallel link resolution, and validation.

## Key Achievements

### 1. Policy Interface and Type System (Runs 1-3)
- PhysicsMappingPolicy interface
- LinkPhysicsParams (restLength, compliance, dampingScale, meta)
- EdgeTypeParams per edge type
- PARAM_CLAMP ranges
- DefaultPhysicsMappingPolicy baseline implementation

### 2. Spring Derivation Integration (Runs 4-6)
- Policy wired into deriveSpringEdges()
- Type-based param assignment
- Policy summary logging (counts per type, compliance stats)
- Weight scaling (lower weight -> softer)

### 3. Parallel Link Resolution (Runs 7-9)
- Strongest wins rule (lowest scaled compliance)
- Deterministic output (stable ordering)
- Provenance tracking (contributors and edge types)
- Validation for NaN/Infinity

### 4. Regression Safety (Runs 10-12)
- Compliance field on SpringEdge (XPBD)
- Legacy semantics preserved (stiffness = weight)
- Compliance computed per policy and weight
- Dev console helper: window.__topology.physicsPolicyDump()

### 5. Validation and Gating (Runs 13-14)
- Warn once per unknown edge type
- Clamp range warnings
- NaN/Infinity detection
- Dev-only helpers gated

## Default Edge Type Mappings

```typescript
const DEFAULT_EDGE_TYPE_POLICY = {
  '*': { compliance: undefined, restLengthPolicy: 'inherit', dampingScale: 1.0 },
  'causes': { compliance: 0.008, restLengthPolicy: 'scale', restLengthScale: 0.9, dampingScale: 1.1 },
  'supports': { compliance: 0.015, restLengthPolicy: 'scale', restLengthScale: 1.1, dampingScale: 0.9 },
  'references': { compliance: 0.03, restLengthPolicy: 'scale', restLengthScale: 1.3, dampingScale: 1.3 },
  'contradicts': { compliance: 0.005, restLengthPolicy: 'scale', restLengthScale: 0.7, dampingScale: 1.4 }
};
```

## Architecture (ASCII)

DirectedLink (kind, weight)
-> PhysicsMappingPolicy.mapLinkParams()
-> LinkPhysicsParams { restLength, compliance, dampingScale, meta }
-> deriveSpringEdges()
-> SpringEdge { a, b, restLen, stiffness, compliance, contributors, meta }
-> springEdgeToPhysicsLink()
-> PhysicsLink

## Parallel Link Resolution

Rule: Strongest wins (lowest scaled compliance)

Example:
```
Input links:
- A->B kind=causes compliance=0.008
- A->B kind=supports compliance=0.015
- A->B kind=relates compliance=0.01

Output spring:
SpringEdge {
  a: 'A', b: 'B',
  restLen: 270,
  compliance: 0.008,
  stiffness: 1.0,
  contributors: ['link-causes', 'link-supports', 'link-relates'],
  meta: { edgeType: 'causes', allEdgeTypes: ['causes','supports','relates'] }
}
```

## Determinism Guarantees

- Same topology -> same spring set and ordering
- Same edge types -> same params
- Shuffled input -> identical output
- Parallel links -> deterministic strongest-wins

## Validation Rules

Unknown edge types:
- Warn once per unknown type, then use wildcard '*'.

Clamped parameters:
- Warn when params are clamped to valid ranges.

Invalid parameters:
- NaN/Infinity logs an error and skips spring creation for that link.

## Console API

```
window.__topology.physicsPolicyDump()
```

## Files Created/Modified

New files:
- src/graph/physicsMappingPolicy/policyTypes.ts
- src/graph/physicsMappingPolicy/defaultPolicy.ts
- src/graph/physicsMappingPolicy/numberUtils.ts
- src/graph/physicsMappingPolicy/index.ts

Modified files:
- src/graph/topologyTypes.ts
- src/graph/springDerivation.ts
- src/graph/springToPhysics.ts
- src/graph/devTopologyHelpers.ts

Documentation:
- docs/step8_physics_mapping_policy.md
- docs/step8_final_report.md

## Commit History

1. step8-run1-3 (a2ced25): Policy seam + interface + baseline integration
2. step8-run4-6 (ec85e7d): Policy mapping table + type-based params + summary logging
3. step8-run7-9 (39444b0): Link weight support + restLen policies + parallel link resolution
4. step8-run10-12 (2c15cd9): Dev console helper + regression fix + docs
5. step8-run13-14 (806823f): Validation + tree-shake gating verification

## Acceptance Criteria

Test 1: Same spec twice -> identical output
- Same spring set and params

Test 2: Shuffled input -> stable output
- Canonical sorting ensures stable ordering

Test 3: Unknown types -> fallback
- Wildcard policy with single warning

Test 4: Parallel links -> deterministic
- Lowest scaled compliance wins

Test 5: Policy changes -> param changes only
- Topology mutation semantics unchanged

## Performance

- Policy lookup: O(1)
- Spring derivation: O(E) where E = directed links
- Parallel link resolution: O(E)
- Validation: O(1) per link

## Future Enhancements

1. Per-link compliance in XPBD solver
2. Policy reloading without topology reload
3. Policy composition
4. Direction-aware params
5. Breakable links
6. Custom policy registration

Sign-off: Step 8 complete. Physics mapping policy enables deterministic, type-aware physics constraint generation with observability and validation.


# Step 8: Physics Mapping Policy

**Date**: 2026-02-04
**Status**: IN PROGRESS
**Runs**: 12 of 15

## Overview

The **Physics Mapping Policy** is a deterministic layer that maps knowledge edge types to physics constraint parameters. Given the same topology snapshot and policy config, it produces identical physics constraints.

## Key Features

### 1. Determinism Guarantees

For the same input topology and policy:
- **Same spring set** - identical undirected edges
- **Same per-spring params** - restLen, compliance, damping
- **Order-independent** - shuffling input produces same output
- **Parallel link resolution** - "strongest wins" rule (lowest compliance)

### 2. Policy Parameters

Per-edge-type physics configuration:
- **compliance** - XPBD inverse stiffness (lower = stiffer)
- **restLengthPolicy** - 'inherit' (global), 'scale' (multiplier), 'fixed' (pixels)
- **restLengthScale** - multiplier when restLengthPolicy='scale'
- **restLengthPixels** - fixed rest length when restLengthPolicy='fixed'
- **dampingScale** - multiplier for global damping

### 3. Clamp Ranges

All params are clamped to safe ranges:
- compliance: [0.0001, 1.0]
- dampingScale: [0.1, 5.0]
- restLength: [20, 2000] pixels
- restLengthScale: [0.1, 5.0]

## Default Edge Type Mappings

```typescript
const DEFAULT_EDGE_TYPE_POLICY = {
    '*': {  // Wildcard fallback
        compliance: undefined,  // Use global xpbdLinkCompliance (0.01)
        restLengthPolicy: 'inherit',
        dampingScale: 1.0
    },
    'causes': {
        compliance: 0.008,  // Stiffer (lower = stiffer)
        restLengthPolicy: 'scale',
        restLengthScale: 0.9,  // 10% shorter
        dampingScale: 1.1
    },
    'supports': {
        compliance: 0.015,  // Softer
        restLengthPolicy: 'scale',
        restLengthScale: 1.1,  // 10% longer
        dampingScale: 0.9
    },
    'references': {
        compliance: 0.03,  // Very soft
        restLengthPolicy: 'scale',
        restLengthScale: 1.3,  // 30% longer
        dampingScale: 1.3
    },
    'contradicts': {
        compliance: 0.005,  // Very stiff
        restLengthPolicy: 'scale',
        restLengthScale: 0.7,  // 30% shorter
        dampingScale: 1.4
    }
};
```

## Architecture

```
DirectedLink (kind, weight)
    ↓
PhysicsMappingPolicy.mapLinkParams()
    ↓
LinkPhysicsParams { restLength, compliance, dampingScale }
    ↓
deriveSpringEdges()
    ↓
SpringEdge {
    restLen: number,
    stiffness: number,      // Legacy mode (0-1)
    compliance?: number,    // XPBD mode (inverse stiffness)
    meta: { policyParams, edgeType, dampingScale, allEdgeTypes }
}
    ↓
springEdgeToPhysicsLink()
    ↓
PhysicsLink { source, target, length, strength, compliance }
```

## Parallel Link Resolution

When multiple directed links exist between the same node pair (e.g., A→B "causes" and A→B "supports"):

**Rule: "Strongest wins"**
- Select the link with **lowest compliance** (highest stiffness)
- All link IDs collected in `contributors` array
- All edge types tracked in `meta.allEdgeTypes`
- Order-independent: shuffling input produces same output

Example:
```javascript
// Links: A→B "causes" (compliance: 0.008), A→B "supports" (compliance: 0.015)
// Result: One spring between A and B with compliance=0.008 (stiffer wins)
// Spring.meta.allEdgeTypes = ['causes', 'supports']
// Spring.contributors = ['link-causes-id', 'link-supports-id']
```

## Weight Scaling

Link weight (semantic confidence, 0-1) scales compliance:
- Lower weight = softer spring (higher compliance)
- Formula: `scaledCompliance = policyCompliance / clampedWeight`
- Clamp range: [0.1, 1.0] to prevent division issues

Example:
```javascript
// Policy compliance: 0.01
// Link weight: 0.5 (low confidence)
// Scaled compliance: 0.01 / 0.5 = 0.02 (softer spring)
```

## Console API

### Dump Policy State

```javascript
// Show current policy configuration and spring stats
window.__topology.physicsPolicyDump()
```

Output:
```
[PhysicsMappingPolicy] Policy Configuration
Edge Type Mappings:
┌─────────┬────────────┬────────────┬────────────┬──────────────┐
│ (index) │   Type     │ Compliance │ RestPolicy │ RestScale    │
├─────────┼────────────┼────────────┼────────────┼──────────────┤
│    0    │ 'causes'   │   0.008    │  'scale'   │     0.9      │
│    1    │'supports'  │   0.015    │  'scale'   │     1.1      │
│    2    │'references'│   0.03     │  'scale'   │     1.3      │
└─────────┴────────────┴────────────┴────────────┴──────────────┘

Parameter Clamp Ranges:
┌─────────┬────────────────┬──────┬──────┐
│ (index) │     Param      │ Min  │ Max  │
├─────────┼────────────────┼──────┼──────┤
│    0    │ 'compliance'   │ 0.0001│  1.0 │
│    1    │'dampingScale'  │  0.1 │  5.0 │
│    2    │ 'restLength'   │  20  │ 2000 │
└─────────┴────────────────┴──────┴──────┘

Current Springs: 15
Edge Type Counts:
┌─────────┬────────────┬────────┐
│ (index) │   Type     │ Count  │
├─────────┼────────────┼────────┤
│    0    │ 'relates'  │   12   │
│    1    │  'causes'  │    3   │
└─────────┴────────────┴────────┘
```

## Implementation Details

### SpringEdge Fields

```typescript
interface SpringEdge {
    a: NodeId;
    b: NodeId;
    restLen: number;          // From policy
    stiffness: number;        // Legacy mode (0-1, = weight)
    compliance?: number;      // XPBD mode (inverse stiffness)
    contributors?: string[];  // All link IDs
    meta?: {
        policyParams: LinkPhysicsParams;
        edgeType: string;
        dampingScale: number;
        allEdgeTypes?: string[];  // For parallel links
    };
}
```

### Stiffness vs Compliance

- **Legacy mode**: Uses `stiffness` field (0-1 range = link weight)
- **XPBD mode**: Uses `compliance` field (inverse stiffness, 0.01 = default)
- **Relationship**: `stiffness ≈ 1/compliance` but scaled differently
- **Regression safety**: Both fields populated, appropriate mode uses appropriate field

## Determinism Verification

### Test 1: Same Topology Twice → Identical Output

```javascript
// Load topology
window.__topology.set(spec)
const hash1 = getTopologySpringsHash()

// Load same topology again
window.__topology.set(spec)
const hash2 = getTopologySpringsHash()

console.log(hash1 === hash2)  // true
```

### Test 2: Shuffled Input → Stable Output

```javascript
const spec1 = { nodes: [...], links: [...] }  // Original order
const spec2 = { nodes: [...], links: [...] }  // Shuffled order

// Both produce identical springs
window.__topology.set(spec1)
const springs1 = window.__topology.get().springs

window.__topology.set(spec2)
const springs2 = window.__topology.get().springs

// Same spring set, same params, same order
console.log(springs1.length === springs2.length)  // true
```

### Test 3: Policy Change → Param Change Only

```javascript
// Load with default policy
window.__topology.set(spec)
const restLen1 = window.__topology.get().springs[0].restLen

// Change policy (e.g., modify restLengthScale)
// (Would require policy reload in real implementation)

// Rest length changes, but spring count/order is identical
const restLen2 = window.__topology.get().springs[0].restLen
console.log(restLen1 !== restLen2)  // true (if policy changed)
```

## Future Enhancements

1. **Per-link compliance in XPBD solver** - Currently uses global compliance, could use per-link
2. **Policy reloading** - Change policy without reloading topology
3. **Policy composition** - Chain multiple policies
4. **Direction-aware params** - Different params for A→B vs B→A
5. **Breakable links** - Remove links under extreme tension

## Files Modified

### New Files
```
src/graph/physicsMappingPolicy/
├── policyTypes.ts         # Interface, types, defaults
├── defaultPolicy.ts       # DefaultPhysicsMappingPolicy implementation
├── numberUtils.ts         # isFinite, clamp, safeDivide
└── index.ts               # Barrel exports
```

### Modified Files
```
src/graph/
├── topologyTypes.ts       # Added compliance field to SpringEdge
├── springDerivation.ts    # Policy integration, parallel link resolution
├── springToPhysics.ts     # Preserve compliance in conversion
└── devTopologyHelpers.ts  # Added physicsPolicyDump()
```

---

**Sign-off**: Step 8 runs 1-12 complete. Physics mapping policy enables deterministic edge-type-aware physics parameters.

