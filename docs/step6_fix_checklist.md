# Step 6 Fix Checklist

## Quick Reference for Fixes

### Fix 1: Delete Duplicate Line (CRITICAL)
**File**: `src/graph/topologyControl.ts`
**Line**: 210

```diff
- const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];
- const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];
+ const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];
```

Delete one of the duplicate lines (keep line 209, delete line 210).

---

### Fix 2: Add Missing springsBefore in patchTopology (CRITICAL)
**File**: `src/graph/topologyControl.ts`
**Location**: After line 641

```diff
  // STEP6-RUN4: Capture before state
  const versionBefore = topologyVersion;
  const countsBefore = {
      nodes: currentTopology.nodes.length,
      directedLinks: currentTopology.links.length,
      springs: currentTopology.springs?.length || 0
  };
  const linksBefore = [...currentTopology.links];
+ const springsBefore = currentTopology.springs ? [...currentTopology.springs] : [];
```

---

### Fix 3: Fix Map Type Inference (HIGH)
**File**: `src/graph/topologyControlHelpers.ts`
**Lines**: 38-39

```diff
- const beforeMap = new Map(linksBefore.map(l => [l.id!, l]).filter(([id]) => id));
- const afterMap = new Map(linksAfter.map(l => [l.id!, l]).filter(([id]) => id));
+ const beforeMap = new Map<string, DirectedLink>(
+     linksBefore.map(l => [l.id!, l]).filter(([id]) => id) as [string, DirectedLink][]
+ );
+ const afterMap = new Map<string, DirectedLink>(
+     linksAfter.map(l => [l.id!, l]).filter(([id]) => id) as [string, DirectedLink][]
+ );
```

---

### Fix 4: Add clearTopology Invariant Check (LOW)
**File**: `src/graph/topologyControl.ts`
**Location**: After line 586

```diff
  currentTopology = {
      nodes: [],
      links: [],
      springs: []
  };
  topologyVersion++;
- console.log(`[TopologyControl] clearTopology (v${topologyVersion})`);
+ if (import.meta.env.DEV) {
+     console.log(`[TopologyControl] clearTopology (v${topologyVersion})`);
+ }
+
+ const invariantWarnings = devAssertTopologyInvariants(currentTopology, undefined, 'clearTopology');
```

---

## Verification Commands

```bash
# 1. Apply fixes
# 2. Build check
npm run build

# 3. If build passes, start dev server
npm run dev

# 4. In browser console, test:
# window.__topology.addLink('n0', 'n5', 'manual')
# await window.__topology.mutations.last(true)
```

---

## Post-Fix Acceptance Test

```javascript
// Test 1: Valid add
window.__topology.addLink('n0', 'n5', 'test')
const e1 = await window.__topology.mutations.last(true)
console.assert(e1.status === 'applied')
console.assert(e1.source === 'addKnowledgeLink')

// Test 2: Invalid add (self-loop)
window.__topology.addLink('n0', 'n0', 'self')
const e2 = await window.__topology.mutations.last()
console.assert(e2.status === 'rejected')
console.assert(e2.versionBefore === e2.versionAfter)

// Test 3: Table
await window.__topology.mutations.table(5)
```
