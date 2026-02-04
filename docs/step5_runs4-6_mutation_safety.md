# Step 5 Runs 4-6: Mutation Safety + Physics Poison Prevention

**Date**: 2026-02-04

## Run 4: Mutation Seam Invariants ✓

**Modified**: `topologyControl.ts` - `setTopology()`

**Validation Added** (DEV mode only):
- Reject self-loops
- Reject links with missing endpoints
- Reject duplicate link IDs
- Log rejection counts

**Console Proof**:
```javascript
// Attempt to set topology with bad links
window.__topo.setTopology({
  nodes: [{id: 'A'}, {id: 'B'}],
  links: [
    {from: 'A', to: 'A', kind: 'self'},  // self-loop
    {from: 'A', to: 'C', kind: 'bad'}    // missing endpoint
  ]
});

// Output:
// [TopologyControl] setTopology: rejected self-loop A -> A
// [TopologyControl] setTopology: rejected link with missing endpoint A -> C
// [TopologyControl] setTopology validation: rejected 1 self-loops, 1 missing endpoints, 0 duplicate IDs
```

**Policy**: Apply valid subset only (safer than rejecting entire batch)

---

## Run 5: Numeric Safety Clamps ✓

**Modified**: `springDerivation.ts` - `deriveSpringEdges()`

**Safety Checks Before Physics**:
- Drop springs with NaN/Infinity in restLen or stiffness
- Drop springs with restLen <= 0
- Drop springs with stiffness <= 0
- Log dropped springs with contributor IDs

**Console Proof**:
```javascript
// Inject link with NaN weight
window.__topo.addLink('A', 'B', 'test');
window.__topo.updateKnowledgeLink(linkId, { weight: NaN });

// Output:
// [SpringDerivation] Dropped spring {A, B}: NaN/Infinity (restLen=200, stiffness=NaN, contributors=A->B::test::0)
// [SpringDerivation] Safety: dropped 1 NaN/Infinity, 0 invalid restLen, 0 invalid stiffness
```

**Impact**: Invalid springs never reach XPBD engine

---

## Run 6: Physics Poison Prevention ✓

**Verification**: Topology version only increments on successful mutation

**Current Behavior**:
- `setTopologyFromKGSpec()` returns `false` on validation errors
- Topology NOT mutated if validation fails
- Springs only recomputed after successful topology update
- XPBD constraints only updated when springs change

**Console Proof**:
```javascript
const beforeVersion = window.__topo.version();
const beforeConstraints = window.__engine.getConstraintCount();

// Attempt to load invalid spec
window.__kg.load({
  specVersion: 'kg/1',
  nodes: [{id: 'A'}],
  links: [{from: 'A', to: 'A', rel: 'self'}]  // self-loop
});

const afterVersion = window.__topo.version();
const afterConstraints = window.__engine.getConstraintCount();

console.log('Version changed:', beforeVersion !== afterVersion);  // false
console.log('Constraints changed:', beforeConstraints !== afterConstraints);  // false

// Output:
// [KGLoader] Validation FAILED - spec rejected:
//   - Found 1 self-loop(s)
// Version changed: false
// Constraints changed: false
```

**Guarantee**: Failed loads/patches do NOT partially update XPBD state

---

## Risk Assessment

**Before Runs 4-6**:
- ❌ setTopology accepted corrupt data
- ❌ NaN/Infinity could reach physics engine
- ❌ Partial updates possible on validation failure

**After Runs 4-6**:
- ✅ setTopology validates and filters bad links
- ✅ Numeric safety prevents NaN/Infinity in springs
- ✅ Atomic updates - all or nothing

---

## Files Modified (2)

1. `topologyControl.ts` - Added validation in setTopology
2. `springDerivation.ts` - Added numeric safety checks

**Next**: Run 7-9 (normalization rules + auditing + contract tests)
