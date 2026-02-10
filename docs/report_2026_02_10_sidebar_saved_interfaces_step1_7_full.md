# Full Progress Report: Saved Interfaces LocalStorage (Step 1 to Step 7.1)

Date: 2026-02-10
Scope: LocalStorage-only saved interfaces flow, from forensic scan through hardening.
Status: Implemented through Step 7.1.

## 0) Executive Summary

This work now supports the full local-first flow:
- Analysis success auto-saves a full snapshot (full parsed document + full topology) into localStorage.
- Sidebar renders "Your Interfaces" from props (no mock dependency for that section).
- AppShell owns saved interfaces state and emits restore intent on click.
- Graph consumes restore intent, restores full payload through the topology seam, and rewires engine.
- Step 7.1 hardening closes key race paths and adds deterministic spawn/restore behavior.

LocalStorage key:
- `arnvoid_saved_interfaces_v1` in `src/store/savedInterfacesStore.ts:4`

## 1) Step 1 Forensic Scan (What/Where/How)

Forensic mapping identified:
- Sidebar rendering and event shielding: `src/components/Sidebar.tsx`
- Analysis success seam and stale guard: `src/document/nodeBinding.ts`
- Topology seam contract: `src/graph/topologyControl.ts`
- Graph spawn/rewire and pending-intent pattern: `src/playground/GraphPhysicsPlayground.tsx`
- AppShell mediation point: `src/screens/AppShell.tsx`

Key design decisions from scan:
- Save trigger must be in analysis success path only, after stale guard and seam application.
- Restore must go through seam (`setTopology`) and existing topology->spring->engine rewire flow.
- Sidebar should stay dumb/presentational; AppShell should own list + selection intent.

## 2) Step 2 Implemented: `savedInterfacesStore` Module

Implemented file:
- `src/store/savedInterfacesStore.ts`

### 2.1 Public API
- `loadSavedInterfaces()` at `src/store/savedInterfacesStore.ts:163`
- `saveAllSavedInterfaces(...)` at `src/store/savedInterfacesStore.ts:180`
- `upsertSavedInterface(...)` at `src/store/savedInterfacesStore.ts:192`
- `deleteSavedInterface(...)` at `src/store/savedInterfacesStore.ts:231`
- `buildSavedInterfaceDedupeKey(...)` at `src/store/savedInterfacesStore.ts:150`

### 2.2 Schema and key
- `SavedInterfaceRecordV1` type at `src/store/savedInterfacesStore.ts:9`
- Key constant at `src/store/savedInterfacesStore.ts:4`
- Full payload fields retained:
  - `parsedDocument: ParsedDocument`
  - `topology: Topology`
  - `analysisMeta?: any`

### 2.3 Dedupe/cap/quota behavior
- Dedupe rule: `docId::hash(canonical({ title, topology }))`
  - hash path: `stableSerialize` + `stableHashDjb2`
- Newest-first sort and cap=20:
  - compare/sort/cap helpers at `src/store/savedInterfacesStore.ts:90`, `src/store/savedInterfacesStore.ts:97`, `src/store/savedInterfacesStore.ts:101`
- Quota failure handling:
  - logs `[savedInterfaces] localStorage_quota_exceeded` in `src/store/savedInterfacesStore.ts:188`
  - does not crash app

## 3) Step 3 Implemented: Save Trigger at Analysis Success

Implemented file:
- `src/document/nodeBinding.ts`

### 3.1 Safe insertion point
Save now happens in `applyAnalysisToNodes(...)` success path after:
- stale-doc guard pass: `src/document/nodeBinding.ts:80`
- topology applied via seam: `src/document/nodeBinding.ts:137`
- inferred title set: around `src/document/nodeBinding.ts:155`

### 3.2 Save payload integrity
Saved record includes:
- full `parsedDocument` (text, warnings, meta)
- full canonical `topology` from seam snapshot
- preview counts and dedupe key

Anchors:
- dedupe build: `src/document/nodeBinding.ts:187`
- upsert call: `src/document/nodeBinding.ts:194`
- success log: `src/document/nodeBinding.ts:211`

### 3.3 Non-run conditions
No save on:
- stale-doc early return (guard path)
- failure/catch path

## 4) Step 4 Implemented: Sidebar "Your Interfaces" Props-Driven

Implemented file:
- `src/components/Sidebar.tsx`

### 4.1 New props
- `interfaces?: SidebarInterfaceItem[]` at `src/components/Sidebar.tsx:65`
- `selectedInterfaceId?: string` at `src/components/Sidebar.tsx:66`
- `onSelectInterface?: (id: string) => void` at `src/components/Sidebar.tsx:67`

### 4.2 Render behavior
- Empty state line: `No saved interfaces yet.` at `src/components/Sidebar.tsx:192`
- Item click dispatch: `onClick={() => onSelectInterface?.(item.id)}` at `src/components/Sidebar.tsx:209`

### 4.3 Input shielding retained
Sidebar continues to block pointer/wheel leak to canvas:
- root pointer/wheel stops: `src/components/Sidebar.tsx:110` to `src/components/Sidebar.tsx:112`
- list item pointer stop: `src/components/Sidebar.tsx:206`

## 5) Step 5 Implemented: AppShell Owns List + Restore Intent

Implemented file:
- `src/screens/AppShell.tsx`

### 5.1 State ownership
- `savedInterfaces` state: `src/screens/AppShell.tsx:66`
- `pendingLoadInterface` state: `src/screens/AppShell.tsx:67`

### 5.2 Load/refresh strategy
- load helper uses `loadSavedInterfaces()`: `src/screens/AppShell.tsx:107`
- refresh on mount and when entering graph screen

### 5.3 Sidebar wiring
- selected id and click handler:
  - `selectedInterfaceId`: `src/screens/AppShell.tsx:276`
  - `onSelectInterface`: `src/screens/AppShell.tsx:277`
- click log: `src/screens/AppShell.tsx:281`

### 5.4 Graph pass-through (intent only)
- `pendingLoadInterface` prop: `src/screens/AppShell.tsx:228`
- `onPendingLoadInterfaceConsumed` prop: `src/screens/AppShell.tsx:229`

## 6) Step 6 Implemented: Graph Restore Consumption via Seam

Implemented file:
- `src/playground/GraphPhysicsPlayground.tsx`

### 6.1 Restore intent consume
- pending load consume effect starts around `src/playground/GraphPhysicsPlayground.tsx:633`
- pre-clear callback call in consume path (one-shot intent pattern)

### 6.2 Full payload restore
Restore order:
1. `documentContext.setDocument(rec.parsedDocument)` at `src/playground/GraphPhysicsPlayground.tsx:651`
2. `setTopology(rec.topology, ...)` at `src/playground/GraphPhysicsPlayground.tsx:656`
3. derive springs/rewire engine from canonical topology

### 6.3 Analysis-vs-restore coordination
Pending analysis effect exits if load intent exists:
- `if (pendingLoadInterface) return;` at `src/playground/GraphPhysicsPlayground.tsx:740`

## 7) Step 7 Implemented: Spawn Overwrite Prevention

Implemented file:
- `src/playground/GraphPhysicsPlayground.tsx`

### 7.1 Explicit default-spawn diagnostics
- skip log: `[graph] default_spawn_skipped reason=pending_restore` at `src/playground/GraphPhysicsPlayground.tsx:617`
- run log: `[graph] default_spawn_run seed=1337` at `src/playground/GraphPhysicsPlayground.tsx:602`

### 7.2 Gate uses pending restore state
- pending intent latch: `src/playground/GraphPhysicsPlayground.tsx:589`
- spawn condition: `src/playground/GraphPhysicsPlayground.tsx:612`

## 8) Step 7.1 Hardening Implemented (Race + Metadata Safety)

Implemented file:
- `src/playground/GraphPhysicsPlayground.tsx`

### 8.1 Centralized init/restore refs
- `hasInitDecisionRef`: `src/playground/GraphPhysicsPlayground.tsx:101`
- `hasDefaultSpawnRunRef`: `src/playground/GraphPhysicsPlayground.tsx:102`
- `hasRestoredSuccessfullyRef`: `src/playground/GraphPhysicsPlayground.tsx:104`
- `pendingRestoreAtInitRef`: `src/playground/GraphPhysicsPlayground.tsx:105`

### 8.2 Strict one-shot spawn runner
- helper `runDefaultSpawnOnce(...)`: `src/playground/GraphPhysicsPlayground.tsx:594`
- fallback log on restore failure:
  - `[graph] default_spawn_fallback reason=restore_failed` at `src/playground/GraphPhysicsPlayground.tsx:600`

### 8.3 Restore lock + success timing
- overlap guard: `if (isRestoringRef.current) return;` at `src/playground/GraphPhysicsPlayground.tsx:635`
- success marker set only after rewire success:
  - `hasRestoredSuccessfullyRef.current = true` at `src/playground/GraphPhysicsPlayground.tsx:711`

### 8.4 Failure fallback
- if restore fails and engine is still empty, run one fallback default spawn:
  - condition and call at `src/playground/GraphPhysicsPlayground.tsx:720` to `src/playground/GraphPhysicsPlayground.tsx:725`

### 8.5 Metadata safety refinement
- full parsed document remains authoritative in context.
- per-dot fallback summary no longer copies full document text.
- fallback summary now lightweight:
  - `const fallbackSummary = \`Saved interface: ${fallbackTitle}\`;` at `src/playground/GraphPhysicsPlayground.tsx:667`

## 9) Current End-to-End Flow

```text
Analyze success
  -> stale-doc guard passes
  -> setTopology (seam)
  -> getTopology snapshot
  -> build full SavedInterfaceRecordV1
  -> upsert localStorage (dedupe + cap)
  -> AppShell load/mapping
  -> Sidebar list render
  -> click saved item
  -> AppShell sets pendingLoadInterface
  -> Graph consumes once
  -> setDocument(full parsedDocument)
  -> setTopology(full topology)
  -> rewire engine
  -> restored interface visible
```

## 10) Validation So Far

Build verification:
- `npm run build` passes after hardening patch.

Manual validation focus used during implementation:
- save only on analysis success
- stale/failure path does not save
- sidebar events do not leak to canvas
- restore path uses topology seam
- default spawn does not overwrite pending restore path

## 11) Known Residual Risks (Post-7.1)

- localStorage payload size can still be large with full parsed text/meta by design.
- malformed records that pass structural checks but contain semantically bad topology can still fail at restore; fallback spawn now protects from blank state.
- cross-tab synchronization for localStorage is not yet implemented.

## 12) Files Touched Across Step 1-7.1

- `src/store/savedInterfacesStore.ts`
- `src/document/nodeBinding.ts`
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `docs/report_2026_02_10_sidebar_saved_interfaces_localstorage.md`

## 13) Final Status

Step 1 through Step 7.1 are complete for localStorage-first saved interfaces.
No backend/OAuth wiring has been introduced in this scope.
