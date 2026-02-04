# Step 5 Run 1: Data Entry Seam Inventory

**Date**: 2026-02-04

## Data Entry Seams Identified

### Seam 1: KGSpec Load (`kgSpecLoader.ts`)
**Entry Point**: `setTopologyFromKGSpec(spec, opts)`

**Current State**:
- Has basic validation via `validateKGSpec()`
- Validation can be bypassed with `opts.validate = false`
- Converts KGSpec → Topology → calls setTopology()

**Required Invariants**:
- ✅ specVersion exists (already checked)
- ✅ nodes array exists (already checked)
- ✅ links array exists (already checked)
- ⚠️ No duplicate node IDs (NOT checked)
- ⚠️ No self-loops (NOT checked at load)
- ⚠️ Link endpoints exist in nodes (NOT checked at load)
- ⚠️ Numeric bounds (weight, etc.) (NOT checked)

### Seam 2: Direct Topology Mutation (`topologyControl.ts`)
**Entry Points**: 
- `setTopology(topology, config?)`
- `patchTopology(patch, config?)`
- `addKnowledgeLink(link, config?)`
- `removeKnowledgeLink(id, config?)`
- `updateKnowledgeLink(id, patch, config?)`

**Current State**:
- `setTopology`: Accepts any topology, recomputes springs
- `patchTopology`: Has validation for self-loops, missing endpoints, duplicate IDs
- ID-based API: Minimal validation

**Required Invariants**:
- ✅ Self-loops rejected in patchTopology (already done)
- ✅ Missing endpoints rejected in patchTopology (already done)
- ✅ Duplicate IDs rejected in patchTopology (already done)
- ⚠️ setTopology has NO validation (accepts corrupt data)
- ⚠️ ID-based API doesn't validate numeric bounds
- ⚠️ No check for stable IDs (IDs shouldn't change)

### Seam 3: Spring Derivation (`springDerivation.ts`)
**Entry Point**: `deriveSpringEdges(topology, config?)`

**Current State**:
- Skips self-loops (logged)
- Skips missing endpoints (logged)
- Deduplicates A→B + B→A → {A,B}
- Computes rest lengths

**Required Invariants**:
- ✅ Self-loops skipped (already done)
- ✅ Missing endpoints skipped (already done)
- ⚠️ No numeric validation (NaN, Infinity in weight/restLen)
- ⚠️ No bounds checking (restLen could be negative or huge)

### Seam 4: Physics Engine Integration (`springToPhysics.ts`, `GraphPhysicsPlayground.tsx`)
**Entry Point**: Springs → PhysicsLink → `engine.addLink()`

**Current State**:
- Converts SpringEdge → PhysicsLink
- No validation before engine consumption

**Required Invariants**:
- ⚠️ No numeric safety (NaN/Infinity could reach XPBD)
- ⚠️ No bounds checking
- ⚠️ No verification that springs match topology version

---

## Invariant Checklist by Seam

### Load-Time (KGSpec → Topology)
1. **Structural**:
   - [ ] specVersion present
   - [ ] nodes/links arrays present
   - [ ] No duplicate node IDs
   - [ ] All link endpoints exist in nodes
   - [ ] No self-loops

2. **Numeric**:
   - [ ] weight in [0, 1] or undefined
   - [ ] No NaN, Infinity in numeric fields

3. **Semantic**:
   - [ ] rel/kind is string or undefined
   - [ ] IDs are strings

### Mutation-Time (Topology Changes)
1. **Structural**:
   - [ ] All links have IDs (after ensureDirectedLinkIds)
   - [ ] No duplicate link IDs
   - [ ] All link endpoints exist in nodes
   - [ ] No self-loops

2. **Numeric**:
   - [ ] weight in [0, 1] or undefined
   - [ ] No NaN, Infinity

3. **State Consistency**:
   - [ ] Springs recomputed after link changes
   - [ ] Topology version incremented

### Physics-Time (Springs → XPBD)
1. **Numeric Safety**:
   - [ ] restLen is finite and > 0
   - [ ] stiffness is finite and > 0
   - [ ] No NaN, Infinity

2. **Structural**:
   - [ ] Spring endpoints exist in nodes
   - [ ] Spring count matches deriveSpringEdges output

---

## Risk Assessment

**High Risk** (can corrupt physics):
- setTopology accepts unvalidated topology
- No numeric bounds before physics engine
- NaN/Infinity could reach XPBD constraints

**Medium Risk** (degraded behavior):
- Missing validation in ID-based API
- No normalization of out-of-bounds values

**Low Risk** (already handled):
- patchTopology has good validation
- Spring derivation skips bad links

---

## Console Proof Snippet

```javascript
// Run 1 inventory complete
console.log('=== STEP 5 RUN 1: Data Entry Seams ===');
console.log('Seam 1: KGSpec Load - kgSpecLoader.ts');
console.log('Seam 2: Topology Mutation - topologyControl.ts');
console.log('Seam 3: Spring Derivation - springDerivation.ts');
console.log('Seam 4: Physics Integration - springToPhysics.ts');
console.log('Total invariants to implement: 20+');
console.log('High risk: setTopology, numeric bounds');
```

---

## Next Steps (Run 2)

Implement `validateKGSpec()` as pure function with:
- Error rules: missing data, duplicates, self-loops, missing endpoints
- Warning rules: missing rel, weight out of bounds, unknown fields
- Return: `{ ok, errors[], warnings[], normalizedSpec? }`
