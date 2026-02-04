# Step 6 Run 1: Seam Analysis + Event Schema

**Date**: 2026-02-04

## Current Mutation Seam Analysis

### Mutation Entry Points (topologyControl.ts)

1. **setTopology(topology, config?)** - Line ~115
   - Validates links via validateLinks helper
   - Rejects if validation fails (returns early)
   - Mutates currentTopology
   - Recomputes springs via deriveSpringEdges
   - Increments topologyVersion
   - Calls devAssertTopologyInvariants

2. **patchTopology(patch, config?)** - Line ~340
   - Builds nextNodes/nextLinks
   - Validates via validateLinks
   - Rejects if validation fails (returns early)
   - Mutates currentTopology
   - Recomputes springs
   - Increments topologyVersion
   - Calls devAssertTopologyInvariants

3. **addKnowledgeLink(link, config?)** - Line ~210
   - Validates single link via validateLinks
   - Rejects if validation fails (returns '')
   - Adds to currentTopology.links
   - Recomputes springs
   - Increments topologyVersion
   - Calls devAssertTopologyInvariants

4. **removeKnowledgeLink(linkId, config?)** - Line ~250
   - Filters currentTopology.links
   - Recomputes springs if removed
   - Increments topologyVersion
   - Calls devAssertTopologyInvariants

5. **updateKnowledgeLink(linkId, patch, config?)** - Line ~280
   - Validates updated link via validateLinks
   - Rejects if validation fails (returns false)
   - Mutates link in place
   - Recomputes springs if needed
   - Increments topologyVersion
   - Calls devAssertTopologyInvariants

6. **clearTopology()** - Line ~330
   - Resets currentTopology
   - Increments topologyVersion

### Indirect Mutation Paths

7. **setTopologyFromKGSpec(spec, opts?)** - kgSpecLoader.ts
   - Validates spec via validateKGSpec
   - Calls toTopologyFromKGSpec
   - Calls setTopology (which emits event)

### Dev Console Helpers (devTopologyHelpers.ts)

8. **window.__topology.addLink(from, to, kind)** - Calls addKnowledgeLink
9. **window.__topology.removeLink(linkId)** - Calls removeKnowledgeLink
10. **window.__topology.clear()** - Calls clearTopology

## Hook Points for Observers

**Primary Hook**: After validation passes and before returning from mutation functions.

**Exact Locations**:
- setTopology: After `topologyVersion++`, before final log
- patchTopology: After `topologyVersion++`, before final log
- addKnowledgeLink: After `topologyVersion++`, before return
- removeKnowledgeLink: After `topologyVersion++`, before return
- updateKnowledgeLink: After `topologyVersion++`, before return
- clearTopology: After `topologyVersion++`, before log

**Rejection Hook**: When validation fails, emit rejected event before returning.

## Proposed Event Schema

```typescript
/**
 * Mutation event status
 */
type MutationStatus = 'applied' | 'rejected';

/**
 * Mutation source/reason
 */
type MutationSource = 
  | 'setTopology'
  | 'patchTopology'
  | 'addKnowledgeLink'
  | 'removeKnowledgeLink'
  | 'updateKnowledgeLink'
  | 'clearTopology'
  | 'kgSpecLoader';

/**
 * Diff summary for directed links
 */
interface LinkDiff {
  added: string[];      // Link IDs added (truncated to first 10)
  removed: string[];    // Link IDs removed (truncated to first 10)
  updated: string[];    // Link IDs updated (same ID, different fields)
  addedCount: number;   // Total count
  removedCount: number; // Total count
  updatedCount: number; // Total count
}

/**
 * Diff summary for springs
 */
interface SpringDiff {
  added: string[];      // Canonical keys added (truncated to first 10)
  removed: string[];    // Canonical keys removed (truncated to first 10)
  addedCount: number;   // Total count
  removedCount: number; // Total count
}

/**
 * Topology counts snapshot
 */
interface TopologyCounts {
  nodes: number;
  directedLinks: number;
  springs: number;
}

/**
 * Mutation event record
 */
interface TopologyMutationEvent {
  // Identity
  mutationId: number;        // Monotonic counter
  timestamp: number;         // Date.now()
  
  // Status
  status: MutationStatus;
  source: MutationSource;
  docId?: string;            // If from KGSpec load
  
  // Version tracking
  versionBefore: number;
  versionAfter: number;      // Same as versionBefore if rejected
  
  // Counts
  countsBefore: TopologyCounts;
  countsAfter: TopologyCounts;  // Same as countsBefore if rejected
  
  // Diff (only for applied mutations)
  linkDiff?: LinkDiff;
  springDiff?: SpringDiff;
  
  // Validation/Invariants
  validationErrors?: string[];   // If rejected
  invariantWarnings?: string[];  // If applied but dev-invariants failed
}
```

## Event Storage Location

**File**: `src/graph/topologyMutationObserver.ts` (NEW)

**Exports**:
- `TopologyMutationEvent` type
- `emitMutationEvent(event)` - Internal emitter
- `getMutationHistory(limit?)` - Get last N events
- `getLastMutation(verbose?)` - Get most recent
- `clearMutationHistory()` - Clear buffer
- `subscribeMutationObserver(callback)` - Returns unsubscribe function

**Dev Gating**: Entire module wrapped in `if (!import.meta.env.DEV)` guard.

## Integration Points

1. **topologyControl.ts**: Import emitMutationEvent, call at hook points
2. **kgSpecLoader.ts**: Pass docId to setTopology via new optional param
3. **devTopologyHelpers.ts**: Expose mutations API via window.__topology.mutations

## Next Steps (Run 2)

- Implement topologyMutationObserver.ts with ring buffer
- Wire nothing yet (just infrastructure)
- Commit: "mutation event infrastructure"
