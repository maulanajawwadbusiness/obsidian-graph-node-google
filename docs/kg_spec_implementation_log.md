# Step 2: Knowledge Graph Spec - Implementation Log

**Goal**: Define versioned KGSpec as input format for parser/AI

---

## Run 1: Scandissect + File Locations

**Date**: 2026-02-04

### Proposed File Structure

#### Core Types & Logic (`src/graph/`)
1. **kgSpec.ts** - KGSpec types and interfaces
   - `KGSpec` interface
   - `KGNode`, `KGLink` types
   - `specVersion` const
   
2. **kgSpecValidation.ts** - Validation logic
   - `validateKGSpec(spec): ValidationResult`
   - Structural checks (IDs, endpoints, self-loops)
   
3. **kgSpecLoader.ts** - Topology conversion
   - `toTopologyFromKGSpec(spec): Topology`
   - `setTopologyFromKGSpec(spec, opts?)`
   - `exportTopologyAsKGSpec(topology): KGSpec`

4. **devKGHelpers.ts** - Dev console commands
   - `window.__kg.load(spec)`
   - `window.__kg.loadJson(str)`
   - `window.__kg.dump()`

#### Documentation (`docs/`)
5. **kg-spec.md** - Public contract
   - Spec format documentation
   - Validation rules
   - Examples
   - Common mistakes

6. **kg_spec_implementation_log.md** - Run notes
   - This file (run-by-run progress)

### Rationale

**Location**: `src/graph/` module
- ✅ Already has topology types
- ✅ Logical grouping with topologyControl, topologyTypes
- ✅ Isolated from physics/rendering

**Naming**: `kgSpec*` prefix
- ✅ Clear namespace separation
- ✅ Easy to find all KG-related files
- ✅ Follows existing patterns (topology*, spring*)

**Separation**: Validation separate from loader
- ✅ Single responsibility
- ✅ Validation reusable
- ✅ Easier testing

### No Behavior Changes
Run 1 is analysis only - no code written yet.

### Next Step (Run 2)
Define KGSpec v1 types with example.

**Files Planned**: 6 (4 code + 2 docs)
**Behavior**: None (planning only)

---

## Run 2: Define KGSpec v1 Types

**Date**: 2026-02-04

### New File: `src/graph/kgSpec.ts`

#### Type Definitions
1. **KGSpecVersion** = `'kg/1'`
   - Format: `kg/{major}.{minor}` or `kg/{major}`
   
2. **KGNode** - Represents a concept/entity
   - `id: string` - Unique identifier
   - `label?: string` - Human-readable (defaults to id)
   - `kind?: string` - Semantic type ('concept', 'person', 'event')
   - `payload?: Record<string, unknown>` - Arbitrary data
   - `source?: { docId?, page?, section? }` - Provenance

3. **KGLink** - Directed semantic relationship
   - `from: string` - Source node ID
   - `to: string` - Target node ID
   - `rel: string` - Relationship type ('causes', 'supports')
   - `weight?: number` - Strength (0-1, default 1.0)
   - `directed?: boolean` - Directionality (default true)
   - `meta?: Record<string, unknown>` - Metadata

4. **KGSpec** - Complete graph specification
   - `specVersion: KGSpecVersion` - Version for compatibility
   - `nodes: KGNode[]` - All nodes
   - `links: KGLink[]` - All directed links
   - `namespace?: string` - Node ID namespace (future)
   - `docId?: string` - Source document
   - `provenance?: { generator?, timestamp?, model? }` - Metadata

#### Example Constant: `EXAMPLE_KG_SPEC`
**Nodes**: 4 (Climate Change, Rising Sea Levels, Extreme Weather, Renewable Energy)
**Links**: 3 (causes, mitigates)
**Purpose**: Testing and demonstration

### Design Decisions
- **Minimal spec**: Only essential fields required
- **Extensible**: `payload`, `meta`, `provenance` for future needs
- **Semantic focus**: `rel` and `kind` for knowledge layer
- **Physics-agnostic**: No spring/force parameters at this level

### Verification
- **Build**: Passed ✓
- **Type safety**: Full TypeScript typing
- **Example**: Compiles and validates structure

### Next Step (Run 3)
Implement validation rules.

**Files Added**: 1
**Behavior**: None (types only)

---

## Run 3: Validation Rules

**Date**: 2026-02-04

### New File: `src/graph/kgSpecValidation.ts`

#### Function: `validateKGSpec(spec): ValidationResult`

##### Checks (Errors)
1. `specVersion` exists and equals 'kg/1'
2. `nodes` array exists and is valid
3. All nodes have non-empty `id` field
4. No duplicate node IDs
5. `links` array exists and is valid
6. All links have `from` and `to` fields
7. No self-loops (`from === to`)
8. No missing endpoint node IDs

##### Checks (Warnings)
1. Missing `rel` field on links
2. Weight outside [0,1] range
3. Empty graph (no nodes)
4. Graph with nodes but no links

#### Return Type
```typescript
{
    ok: boolean,       // True if no errors
    errors: string[],  // Fatal issues
    warnings: string[] // Non-fatal issues
}
```

### Design
- **Purely structural**: No physics assumptions
- **Clear messages**: Each error/warning descriptive
- **Fail-fast**: Stop validation if fundamental structures missing
- **Defensive**: Checks array types before iteration

### Verification
- **Build**: Passed ✓
- **Logic**: Covers all failure modes from pre-step2

**Files Added**: 1
**Behavior**: None (validation only)

---

## Run 4: Loader KGSpec → Topology

**Date**: 2026-02-04

### New File: `src/graph/kgSpecLoader.ts`

#### Functions

1. **toTopologyFromKGSpec(spec): Topology**
   - Pure conversion (no state mutation)
   - Maps KGNode → NodeSpec
   - Maps KGLink → DirectedLink
   - Console logs (dev-only): node/link counts + samples

2. **setTopologyFromKGSpec(spec, opts?): boolean**
   - Validates first (optional)
   - Rejects on errors → no topology mutation
   - Calls setTopology() if valid
   - Returns success/failure

3. **exportTopologyAsKGSpec(topology?): KGSpec**
   - Roundtrip function for debug/save/load
   - Adds provenance metadata

#### Console Proof
```
[KGLoader] Converted KGSpec to Topology: 4 nodes, 3 links
[KGLoader] Sample links (first 5): [...]
[KGLoader] ✓ Loaded KGSpec (kg/1): 4 nodes, 3 links
```

#### Mapping
- `id` → `id`
- `label` → `label` (or id if missing)
- `kind` → `meta.kind`
- `rel` → `kind` (DirectedLink)
- `weight` → `weight`
- `source`, `payload` → `meta`

### Verification
- **Build**: Passed ✓
- **Behavior**: Ingestion API working, validation enforced

**Files Added**: 1
**Behavior**: Can now load KGSpec into topology (but not wired to UI yet)

---

## Run 5: Ingestion API (Already Complete in Run 4)

**Note**: Run 5 was already implemented as part of Run 4's `kgSpecLoader.ts`.

### Function: `setTopologyFromKGSpec(spec, opts?)`

**Features**:
- Validates before mutating (optional, default true)
- Rejects on errors → no topology change
- Console warns with error details
- Returns boolean success/failure

**Options**:
- `validate?: boolean` - Run validation first (default true)
- `allowWarnings?: boolean` - Accept spec with warnings (default true)

**Console Output**:
```
[KGLoader] Validation failed. Topology NOT updated.
[KGLoader] Errors (2): ...
[KGLoader] ✓ Loaded KGSpec (kg/1): 4 nodes, 3 links
```

**Behavior**: Same as run 4 - ingestion API already working.

---

## Run 6: Dev Console Commands

**Date**: 2026-02-04

### New File: `src/graph/devKGHelpers.ts`

#### Exposed API: `window.__kg` (Dev-Only)

1. **load(spec)** - Load KGSpec object
2. **loadJson(jsonString)** - Parse and load JSON string
3. **validate(spec)** - Validate without loading
4. **dump()** - Export current topology as KGSpec
5. **loadExample()** - Load EXAMPLE_KG_SPEC

#### Dev Gating
- Top-of-file guard: `if (!import.meta.env.DEV) throw Error`
- Runtime gate: `if (import.meta.env.DEV && typeof window)`
- Dynamic import in GraphPhysicsPlayground.tsx

#### Console Proof
```javascript
// In browser console:
window.__kg.loadExample();
// → [DevKG] loadExample: loading EXAMPLE_KG_SPEC...
// → [DevKG] load: attempting to load spec with 4 nodes, 3 links
// → [KGLoader] ✓ Loaded KGSpec (kg/1): 4 nodes, 3 links

window.__kg.dump();
// → [DevKG] dump: exporting current topology as KGSpec...
// → [DevKG] Exported spec: {...}

window.__kg.validate(someSpec);
// → [DevKG] Validation PASSED ✓
```

### Integration
**File**: `GraphPhysicsPlayground.tsx`
- Added dynamic import: `import('../graph/devKGHelpers')`
- Guards with `if (import.meta.env.DEV)`

**Files Added**: 1
**Files Modified**: 1
**Behavior**: `window.__kg` available in dev mode
