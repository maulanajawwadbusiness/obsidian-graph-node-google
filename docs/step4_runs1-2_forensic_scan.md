# Step 4 Runs 1-2: Forensic Scan + Truth Map

**Date**: 2026-02-04

## Dangerous Callsites Found

### 1. **springDerivation.ts** (Lines 48-50) - ⚠️ CRITICAL
```typescript
// Canonical key: always min(from, to) : max(from, to)
const a = link.from < link.to ? link.from : link.to;
const b = link.from < link.to ? link.to : link.from;
```

**Danger**: This is CORRECT for physics spring deduplication (undirected), but the comment and variable names (`a`, `b`) are misleading. This canonicalization should ONLY happen for spring keys, never for knowledge link identity.

**Impact**: Currently safe because it's only used for spring derivation, but risky if copied elsewhere.

### 2. **topologyControl.ts** (Lines 158-163) - ⚠️ SEMANTIC DIRECTION LOSS
```typescript
const removeKeys = new Set(
    patch.removeLinks.map(l => `${l.from}:${l.to}`)
);
currentTopology.links = currentTopology.links.filter(
    l => !removeKeys.has(`${l.from}:${l.to}`)
);
```

**Danger**: Uses `${from}:${to}` as link identity. This means:
- A→B and B→A are correctly distinguished ✓
- BUT: Multiple parallel edges (A→B with different `rel`) cannot be distinguished ✗
- Removing "A→B with rel=causes" would also remove "A→B with rel=supports"

**Impact**: **CRITICAL** - Parallel edges with same endpoints are impossible

### 3. **topologyControl.ts** (Lines 185-195) - ⚠️ DUPLICATE DETECTION HAZARD
```typescript
const existingKeys = new Set(currentTopology.links.map(l => `${l.from}:${l.to}`));

for (const link of patch.addLinks) {
    // ...
    const key = `${link.from}:${l.to}`;
    if (existingKeys.has(key)) {
        deduped++;
        continue;
    }
    // ...
}
```

**Danger**: Same issue - uses `${from}:${to}` for deduplication.
- Cannot add A→B with rel=causes if A→B with rel=supports already exists
- Silently dedupes parallel edges

**Impact**: **CRITICAL** - Multi-edge graphs impossible

---

## Summary of Hazards

| Location | Hazard | Severity | Impact |
|----------|--------|----------|--------|
| `springDerivation.ts:48-50` | Canonicalization (OK for springs) | Low | Safe if contained |
| `topologyControl.ts:158-163` | `${from}:${to}` for removal | **CRITICAL** | Parallel edges impossible |
| `topologyControl.ts:185-195` | `${from}:${to}` for deduplication | **CRITICAL** | Parallel edges impossible |

---

## Proposed Solution: directedLinkId

### New Addressing Scheme

**Principle**: Every directed knowledge link gets a unique, stable ID that NEVER sorts endpoints.

#### Option A: User-Provided IDs (Preferred)
```typescript
interface DirectedLink {
    id?: string;  // NEW: Unique identifier
    from: NodeId;
    to: NodeId;
    kind?: string;
    weight?: number;
    meta?: any;
}
```

- KGSpec can provide IDs explicitly
- If missing, generate at load time

#### Option B: Deterministic Generation
```typescript
function generateDirectedLinkId(link: DirectedLink, index: number): string {
    // Never sorts endpoints - preserves direction
    const rel = link.kind || 'relates';
    return `${link.from}→${link.to}::${rel}::${index}`;
}
```

**Example**:
- A→B (rel=causes) → `A→B::causes::0`
- B→A (rel=refutes) → `B→A::refutes::0`
- A→B (rel=supports) → `A→B::supports::1` (parallel edge)

### Coverage Verification

✅ **A→B vs B→A**: Different IDs (`A→B::...` vs `B→A::...`)  
✅ **Multi-edges**: Index suffix allows parallel edges  
✅ **Update/Remove by ID**: Direct lookup, no ambiguity  
✅ **Stable**: ID doesn't change unless link is recreated

---

## Implementation Plan (Runs 3-10)

### Run 3-4: Introduce Stable Identity
1. Add `id?: string` to `DirectedLink` type
2. Generate IDs at KGSpec load if missing
3. Update topology storage to use Map<linkId, DirectedLink>

### Run 5-6: API + Mutation Safety
1. New API: `addKnowledgeLink(link)` → returns id
2. New API: `removeKnowledgeLink(id)` - never affects other links
3. New API: `updateKnowledgeLink(id, patch)`
4. New API: `getKnowledgeLink(id)`

### Run 7-8: Spring Derivation
1. Keep canonicalization ONLY in spring key
2. Add provenance: `spring.contributors = [linkId1, linkId2]`
3. Clear documentation: "This is for physics, not semantics"

### Run 9-10: Acceptance Tests
1. Load 4 links: A→B (causes), B→A (refutes), A→B (supports), A→B (evidence)
2. Verify: 4 knowledge links, 1 spring
3. Remove one by ID: 3 knowledge links remain, spring still exists
4. Remove all A→B: spring disappears

---

## Next Steps

Proceed with Run 3-4 to implement directedLinkId.
