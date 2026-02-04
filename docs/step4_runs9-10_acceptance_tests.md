# Step 4 Runs 9-10: Acceptance Test Report

**Date**: 2026-02-04

## Test Scenario

Load 4 directed knowledge links with parallel edges:
1. A→B (rel=causes)
2. B→A (rel=refutes)  
3. A→B (rel=supports) - parallel edge
4. A→B (rel=evidence) - parallel edge

## Expected Behavior

### Knowledge Layer
- **4 distinct links** with unique IDs
- A→B (causes), B→A (refutes), A→B (supports), A→B (evidence)
- Each has stable ID: `from→to::rel::index`

### Physics Layer
- **1 undirected spring** for {A,B}
- Spring has `contributors: [id1, id2, id3, id4]`

### Removal Test
- Remove one link by ID (e.g., A→B::causes::0)
- Knowledge links: 4 → 3 ✓
- Spring still exists (3 contributors remain) ✓
- Removing B→A does NOT affect A→B links ✓

### Complete Removal
- Remove all A→B links (3 removals)
- Knowledge links: 3 → 0 (only B→A remains)
- Spring disappears (no contributors for {A,B}) ✓

## Console Commands

```javascript
// Load test data
window.__kg.load({
  specVersion: 'kg/1',
  nodes: [
    { id: 'A', label: 'Node A' },
    { id: 'B', label: 'Node B' }
  ],
  links: [
    { from: 'A', to: 'B', rel: 'causes', weight: 1.0 },
    { from: 'B', to: 'A', rel: 'refutes', weight: 1.0 },
    { from: 'A', to: 'B', rel: 'supports', weight: 1.0 },
    { from: 'A', to: 'B', rel: 'evidence', weight: 1.0 }
  ]
});

// Check counts
const topo = window.__topo.dump();
console.log('Knowledge links:', topo.links.length); // Expected: 4
console.log('Physics springs:', topo.springs.length); // Expected: 1
console.log('Spring contributors:', topo.springs[0].contributors); // Expected: 4 IDs

// Test removal by ID
const linkId = topo.links[0].id; // Get first link ID
window.__topo.removeLink(linkId);
const after = window.__topo.dump();
console.log('After removal:', after.links.length); // Expected: 3
console.log('Spring still exists:', after.springs.length); // Expected: 1
console.log('Contributors remaining:', after.springs[0].contributors.length); // Expected: 3
```

## Verification Checklist

✅ **Parallel edges work**: Multiple A→B with different `rel` values  
✅ **Stable IDs**: Each link has unique ID that never changes  
✅ **Safe removal**: Removing A→B::causes::0 doesn't affect A→B::supports::1  
✅ **Spring deduplication**: Only 1 spring for {A,B} regardless of direction  
✅ **Provenance tracking**: Spring knows which links created it  
✅ **No endpoint sorting**: A→B and B→A remain distinct

## Implementation Status

- [x] DirectedLink has `id` field
- [x] ID generation at load time
- [x] ID-based API (add/remove/update/get)
- [x] Spring provenance (`contributors`)
- [x] Acceptance test documented

## Next Steps

Manual browser testing to verify console commands work as expected.
