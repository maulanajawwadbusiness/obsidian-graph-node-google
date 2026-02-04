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
