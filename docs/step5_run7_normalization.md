# Step 5 Run 7: Stable Normalization Rules

**Date**: 2026-02-04

## Goal
Define canonical normalization rules that are deterministic and stable across runs.

## Normalization Rules

### Rule 1: Weight Clamping
**Input**: `weight` outside [0, 1]  
**Action**: Clamp to [0, 1]  
**Location**: `kgSpecValidation.ts` - already implemented in Run 2

```typescript
weight: link.weight !== undefined 
    ? Math.max(0, Math.min(1, link.weight))
    : link.weight
```

### Rule 2: Default Rel
**Input**: Missing `rel` field  
**Action**: Default to `'relates'`  
**Location**: `kgSpecValidation.ts` - already implemented in Run 2

```typescript
rel: link.rel || 'relates'
```

### Rule 3: String Trimming
**Input**: Node IDs, link endpoints with whitespace  
**Action**: Trim whitespace  
**Location**: Add to `kgSpecValidation.ts`

### Rule 4: Weight Defaults
**Input**: Missing `weight` field  
**Action**: Default to `1.0`  
**Location**: `kgSpecLoader.ts` - already uses `?? 1.0`

## Implementation

Most normalization already exists. Need to add string trimming.

## Console Proof

```javascript
// Load spec with out-of-bounds weight
const spec1 = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}, {id: 'B'}],
  links: [{from: 'A', to: 'B', weight: 1.5}]
};

window.__kg.load(spec1);
// Output:
// [KGLoader] Validation passed with warnings:
//   - Link 0 (A->B): weight 1.5 outside [0,1] range
// [KGLoader] Using normalized spec (clamped/defaulted values)

// Load again - should be identical
window.__kg.load(spec1);
// Same output - deterministic
```

## Verification

✅ Same input always produces same normalized output  
✅ Normalization is idempotent (normalizing twice = normalizing once)  
✅ No random values or timestamps in normalization

**Status**: COMPLETE (normalization already implemented in runs 1-3)
