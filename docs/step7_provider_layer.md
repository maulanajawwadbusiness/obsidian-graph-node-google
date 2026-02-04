# Step 7: Deterministic Topology Provider Layer

**Date**: 2026-02-04
**Status**: COMPLETE

## Overview

The **Topology Provider Layer** is a deterministic abstraction above the topology mutation seam. Given the same input, a provider always produces the same topology output (same node IDs, link IDs, ordering, and derived springs).

## Key Features

### 1. Determinism Guarantees

For the same input:
- **Same node IDs** - derived from input spec, never random
- **Same directed link IDs** - format: `${from}->${to}::${rel}::${index}`
- **Same ordering** - nodes and links sorted by ID
- **Same derived springs** - computed from normalized topology

### 2. Stable Hashing

Every provider input is hashed for observability:
- Hash uses DJB2 algorithm (fast, no crypto dependencies)
- Canonical JSON with sorted keys for consistent output
- Hash included in mutation events for tracking

### 3. Normalization

KGSpecProvider applies these normalizations:
- **Deduplicate nodes** by ID (keep first occurrence)
- **Deduplicate links** by `(from, to, kind)` tuple (keep first)
- **Normalize labels** - trim whitespace, fallback to ID
- **Normalize relations** - trim whitespace, default to 'relates'
- **Sort by ID** - canonical ordering for determinism

## Provider Types

### KGSpecProvider

**Purpose**: Load KGSpec (knowledge graph specification) into topology

```typescript
import { applyTopologyFromProvider } from './graph/providers';

// Load a KGSpec through the provider
const result = applyTopologyFromProvider('kgSpec', myKGSpec, {
    docId: 'document-123'
});

console.log(result.changed);    // true if topology changed
console.log(result.version);    // new topology version
```

### ManualMutationProvider

**Purpose**: Individual topology mutations (addLink, removeLink)

```typescript
import { applyTopologyFromProvider } from './graph/providers';

// Add a link through the provider
const result = applyTopologyFromProvider('manualMutation', {
    type: 'addLink',
    link: { from: 'A', to: 'B', kind: 'connects', weight: 1.0 }
});

// Remove a link
const result = applyTopologyFromProvider('manualMutation', {
    type: 'removeLink',
    linkId: 'A->B::connects::0'
});
```

## Console API

### Provider Mutation Events

Mutation events from providers include:
- `provider` - provider name (e.g., 'kgSpec', 'manualMutation')
- `inputHash` - stable hash of input (truncated to 8 chars)

```javascript
// Get last mutation
const event = await window.__topology.mutations.last(true);
console.log(event.provider);   // 'kgSpec'
console.log(event.inputHash);  // 'A3F7B2C1'
```

### Mutation Table

```javascript
// Show mutations with provider info
await window.__topology.mutations.table(10);
// Output includes: ID | Status | Source | Provider | Hash | V-> | dN | dL | dS
```

### Stability Test

```javascript
// Test that input shuffling produces stable output
window.__kg.testStability();
// Shuffles input 5 times and verifies output hash is identical
```

## Registry

### List Providers

```javascript
// Not yet exposed to console, but available in code:
import { listProviders } from './graph/providers';
console.log(listProviders()); // ['kgSpec', 'manualMutation']
```

### Custom Providers

```typescript
import { registerProvider, type TopologyProvider } from './graph/providers';

const myProvider: TopologyProvider<MyInput> = {
    name: 'myProvider',
    buildSnapshot(input: MyInput) {
        return {
            nodes: [...],
            directedLinks: [...],
            meta: { provider: 'myProvider', inputHash: hashInput(input) }
        };
    },
    hashInput(input: MyInput): string {
        return hashObject(input);
    }
};

registerProvider({ provider: myProvider });
```

## Acceptance Tests

### Test 1: Load Same Spec Twice → Noop

```javascript
// Load spec
window.__kg.load(mySpec);

// Load same spec again → should be NOOP (version unchanged)
window.__kg.load(mySpec);

// Verify
const event = await window.__topology.mutations.last();
console.log(event.reason); // 'noop'
console.log(event.versionBefore === event.versionAfter); // true
```

### Test 2: Shuffled Input → Stable Output

```javascript
const spec1 = { nodes: [{id:'B'}, {id:'A'}], links: [...] };
const spec2 = { nodes: [{id:'A'}, {id:'B'}], links: [...] };

// Both produce identical topology (sorted by ID)
window.__kg.load(spec1);
const hash1 = getTopologyHash();

window.__kg.load(spec2);
const hash2 = getTopologyHash();

console.log(hash1 === hash2); // true
```

### Test 3: Invalid Spec → Rejected

```javascript
const invalidSpec = {
    nodes: [{id:'A'}, {id:'A'}], // duplicate node ID
    links: []
};

window.__kg.load(invalidSpec);

// Verify rejection
const event = await window.__topology.mutations.last();
console.log(event.status); // 'rejected'
console.log(event.reason); // 'validation'
console.log(event.validationErrors); // ['duplicate node ID: A']
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Provider Layer                    │
│  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │ KGSpec      │  │ ManualMutation              │  │
│  │ Provider    │  │ Provider                    │  │
│  └──────┬──────┘  └──────────┬──────────────────┘  │
│         │                     │                      │
│         └──────────┬──────────┘                      │
│                    ↓                                 │
│         ┌──────────────────────┐                    │
│         │ applyTopologyFrom    │                    │
│         │ Provider()           │                    │
│         └──────────┬───────────┘                    │
│                    ↓                                 │
└────────────────────┼─────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│              Topology Control Seams                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │setTopology│  │patchTopo │  │addKnowledgeLink  │   │
│  └─────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│        └───────────────┴──────────────────┘           │
│                      ↓                                 │
│         ┌──────────────────────────┐                 │
│         │ Mutation Observer        │                 │
│         │ (events, ring buffer)    │                 │
│         └──────────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

## File Structure

```
src/graph/providers/
├── providerTypes.ts      # TopologyProvider interface, types
├── hashUtils.ts          # Stable hashing utilities
├── KGSpecProvider.ts     # KGSpec provider (normalization)
├── ManualMutationProvider.ts  # Manual mutation provider
├── providerRegistry.ts   # Provider registration
├── applyProvider.ts      # applyTopologyFromProvider()
├── stabilityTest.ts      # Stability test utilities
└── index.ts              # Barrel exports
```

## Integration Points

### KGSpec Load Path

**Before**: `KGSpec → setTopologyFromKGSpec → setTopology`
**After**: `KGSpec → applyTopologyFromProvider('kgSpec') → setTopology`

### Dev Helpers Path

**Before**: `addLink() → addKnowledgeLink()`
**After**: Same (directly deterministic via `directedLinkId.ts`)

Provider available for consistency: `applyTopologyFromProvider('manualMutation', ...)`

## Performance

- **Hash computation**: O(N) where N = input size
- **Normalization**: O(N log N) for sorting
- **Zero production cost**: Provider types and imports are tree-shaken in production

## Future Enhancements

- [ ] Undo/redo via provider input replay
- [ ] Provider selection config knob
- [ ] Export provider history as JSON
- [ ] Provider composition (multiple providers chained)

---

**Sign-off**: Step 7 complete. Topology provider layer enables deterministic, observable topology generation.
