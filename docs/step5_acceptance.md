# Step 5 Acceptance Checklist

**Date**: 2026-02-04  
**Purpose**: Manual verification that Step 5 validation and invariants work correctly

## Prerequisites

1. Build and run dev server: `npm run dev`
2. Open browser console
3. Ensure `window.__kg` is available

## Test Suite

### Test 1: Valid Spec (Should Pass)

```javascript
const validSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}, {id: 'B'}, {id: 'C'}],
  links: [
    {from: 'A', to: 'B', rel: 'causes', weight: 0.8},
    {from: 'B', to: 'C', rel: 'supports', weight: 1.0}
  ]
};

window.__kg.load(validSpec);
```

**Expected Output**:
```
[KGLoader] Validation passed
[KGLoader] Topology loaded successfully
```

**Pass Criteria**: ✓ No errors, topology loads successfully

---

### Test 2: Self-Loop (Should Reject)

```javascript
const selfLoopSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}],
  links: [{from: 'A', to: 'A', rel: 'self'}]
};

window.__kg.load(selfLoopSpec);
```

**Expected Output**:
```
[KGLoader] Validation FAILED - spec rejected:
  - Found 1 self-loop(s)
```

**Pass Criteria**: ✓ Validation fails, topology NOT mutated

---

### Test 3: Missing Endpoint (Should Reject)

```javascript
const missingEndpointSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}],
  links: [{from: 'A', to: 'B', rel: 'missing'}]
};

window.__kg.load(missingEndpointSpec);
```

**Expected Output**:
```
[KGLoader] Validation FAILED - spec rejected:
  - Found 1 link(s) with missing endpoints
```

**Pass Criteria**: ✓ Validation fails, topology NOT mutated

---

### Test 4: Out-of-Bounds Weight (Should Warn + Normalize)

```javascript
const outOfBoundsSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}, {id: 'B'}],
  links: [{from: 'A', to: 'B', rel: 'test', weight: 1.5}]
};

window.__kg.load(outOfBoundsSpec);
```

**Expected Output**:
```
[KGLoader] Validation passed with warnings:
  - Link 0 (A->B): weight 1.5 outside [0,1] range
[KGLoader] Using normalized spec (clamped/defaulted values)
```

**Pass Criteria**: ✓ Loads with warning, weight clamped to 1.0

---

### Test 5: NaN Weight (Should Reject)

```javascript
const nanWeightSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}, {id: 'B'}],
  links: [{from: 'A', to: 'B', rel: 'test', weight: NaN}]
};

window.__kg.load(nanWeightSpec);
```

**Expected Output**:
```
[KGLoader] Validation FAILED - spec rejected:
  - Link 0 (A->B): weight is NaN or Infinity
```

**Pass Criteria**: ✓ Validation fails, topology NOT mutated

---

### Test 6: Whitespace Trimming (Should Warn + Normalize)

```javascript
const whitespaceSpec = {
  specVersion: 'kg/1',
  nodes: [{id: ' A '}, {id: 'B '}],
  links: [{from: ' A ', to: 'B ', rel: ' causes ', weight: 1.0}]
};

window.__kg.load(whitespaceSpec);
```

**Expected Output**:
```
[KGLoader] Validation passed with warnings:
  - Trimmed 2 node id(s) (e.g., ...)
  - Trimmed 2 link endpoint(s) (e.g., ...)
  - Trimmed 1 rel value(s) (e.g., ...)
[KGLoader] Using normalized spec (clamped/defaulted values)
```

**Pass Criteria**: ✓ Loads with warnings, IDs/endpoints/rel trimmed

---

### Test 7: Contract Tests (Should All Pass)

```javascript
window.__kg.contractTests();
```

**Expected Output**:
```
=== STEP5 RUN9: Contract Tests ===
[PASS] Valid spec: PASS
[PASS] Self-loop: FAIL (expected)
[PASS] Missing endpoint: FAIL (expected)
[PASS] Duplicate dot ID: FAIL (expected)
[PASS] NaN weight: FAIL (expected)
[PASS] Unknown rel (warning only): PASS
=== Results: 6/6 passed, 0 failed ===
```

**Pass Criteria**: ✓ All 6 tests pass

---

### Test 8: Physics Poison Prevention

```javascript
// Get initial state
const beforeVersion = window.__topo.version();

// Attempt to load invalid spec
const invalidSpec = {
  specVersion: 'kg/1',
  nodes: [{id: 'A'}],
  links: [{from: 'A', to: 'A', rel: 'self'}]
};

window.__kg.load(invalidSpec);

// Check state unchanged
const afterVersion = window.__topo.version();
console.log('Version unchanged:', beforeVersion === afterVersion);
```

**Expected Output**:
```
[KGLoader] Validation FAILED - spec rejected:
  - Found 1 self-loop(s)
Version unchanged: true
```

**Pass Criteria**: ✓ Topology version unchanged after failed load

---

## Summary

**Total Tests**: 8  
**Required Passes**: 8/8

**Sign-off**: All tests must pass for Step 5 acceptance.

## Notes

- All validation errors should be clear and actionable
- Warnings should not block loading (unless `allowWarnings=false`)
- Normalization should be deterministic and idempotent
- Failed loads should NEVER partially mutate topology
