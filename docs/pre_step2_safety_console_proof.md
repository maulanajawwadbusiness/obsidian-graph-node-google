# Pre-Step2 Safety Rails - Console Proof

## Validation Test Scenarios

### Test 1: Self-Loop Rejection
```javascript
// In browser console:
window.__topology.addLink('n0', 'n0', 'self-loop-test');

// Expected output:
// [DevTopology] addLink: n0 → n0 (kind: self-loop-test)
// [TopologyControl] Rejected self-loop: n0 → n0
// [TopologyControl] Validation: accepted=0, rejectedSelfLoops=1, rejectedMissing=0, deduped=0
```

### Test 2: Missing Endpoint Rejection
```javascript
// In browser console:
window.__topology.addLink('n0', 'n999', 'missing-endpoint-test');

// Expected output:
// [DevTopology] addLink: n0 → n999 (kind: missing-endpoint-test)
// [TopologyControl] Rejected link with missing endpoint: n0 → n999 (nodes exist: from=true, to=false)
// [TopologyControl] Validation: accepted=0, rejectedSelfLoops=0, rejectedMissing=1, deduped=0
```

### Test 3: Duplicate Link Rejection
```javascript
// In browser console (assuming n0→n1 already exists):
window.__topology.addLink('n0', 'n1', 'duplicate-test');

// Expected output:
// [DevTopology] addLink: n0 → n1 (kind: duplicate-test)
// [TopologyControl] Validation: accepted=0, rejectedSelfLoops=0, rejectedMissing=0, deduped=1
```

### Test 4: Valid Link Acceptance
```javascript
// In browser console:
window.__topology.addLink('n0', 'n5', 'valid-link');

// Expected output:
// [DevTopology] addLink: n0 → n5 (kind: valid-link)
// [TopologyControl] patchTopology: nodes 10→10, links 15→16 (v2)
// (No validation warnings = all accepted)
```

### Test 5: Dev Mode Gating
```javascript
// After production build (npm run build):
// window.__topology should be undefined
console.log(window.__topology);

// Expected output:
// undefined
// Console: "[DevTopology] Helpers disabled in production build."
```

## Changes Made

### 1. devTopologyHelpers.ts
- Added `import.meta.env.DEV` check
- Only exposes `window.__topology` in dev mode
- Logs warning in production

### 2. GraphPhysicsPlayground.tsx
- Wrapped import with `if (import.meta.env.DEV)`
- Prevents bundling in production

### 3. topologyControl.ts (patchTopology)
- Validates all `addLinks` before applying
- Rejects self-loops: `from === to`
- Rejects missing endpoints: checks against `nodeIdSet`
- Deduplicates: checks against `existingKeys`
- Logs summary: `accepted, rejectedSelfLoops, rejectedMissing, deduped`

## Deterministic Behavior

✅ **All-or-nothing per link**: Each link is independently validated
✅ **No partial application**: Invalid links are skipped, valid ones are added
✅ **Clear warnings**: Each rejection logged with console.warn
✅ **Summary stats**: Logged once per patchTopology call
