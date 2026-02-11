# Report: Sidebar Saved Interfaces (LocalStorage First)

Date: 2026-02-10
Mode: Forensic scan and implementation plan only (no code changes)

## Scope and Goal

Goal confirmed:
- After paper analyzer finishes and topology is applied, save a snapshot automatically.
- Sidebar "Your Interfaces" lists snapshots newest first.
- Clicking a snapshot restores map on graph screen through topology seam.
- Persistence is localStorage only.

## A) Sidebar Reality and Data Ownership

### Current rendering and mock source
- Sidebar component: `src/components/Sidebar.tsx:67`
- "Your Interfaces" section starts: `src/components/Sidebar.tsx:180`
- Header text render: `src/components/Sidebar.tsx:183`
- Mock list source: `src/components/Sidebar.tsx:12`
- Mock list mapping: `src/components/Sidebar.tsx:185`
- Item label display: `src/components/Sidebar.tsx:196`

### Pointer and wheel shielding
- Sidebar root stops pointer down bubbling: `src/components/Sidebar.tsx:104`
- Sidebar root stops wheel capture bubbling: `src/components/Sidebar.tsx:105`
- Sidebar root stops wheel bubbling: `src/components/Sidebar.tsx:106`

Forensic conclusion:
- Sidebar already behaves as an input black hole over canvas.
- It is safe to add clickable saved-interface items without changing the ownership model, as long as stopPropagation pattern remains.

### Minimal props needed (plan)
Current props are only expand/toggle/docviewer:
- Props type: `src/components/Sidebar.tsx:59`

Planned minimal additions:
- `interfaces: SavedInterfaceListItem[]`
- `onSelectInterface: (id: string) => void`
- Optional quality-of-life:
- `selectedInterfaceId?: string`
- `onDeleteInterface?: (id: string) => void` (later, optional)

Reason:
- Keeps Sidebar presentational and data-agnostic.
- Ownership of persistence and restore intent stays in AppShell/store.

## B) Where "Map Is Ready" Actually Exists

### Success path in analyzer binding
Main function:
- `applyAnalysisToNodes`: `src/document/nodeBinding.ts:42`

Sequence in success path:
1. Analyzer call returns points and links: `src/document/nodeBinding.ts:67`
2. Stale-doc guard check: `src/document/nodeBinding.ts:70`
3. Early return if stale: `src/document/nodeBinding.ts:75`
4. Topology seam apply: `src/document/nodeBinding.ts:130`
5. Canonical topology read: `src/document/nodeBinding.ts:135`
6. Engine rewiring complete: `src/document/nodeBinding.ts:142` to `src/document/nodeBinding.ts:145`
7. Inferred title dispatch: `src/document/nodeBinding.ts:148` and `src/document/nodeBinding.ts:150`
8. Success logs: `src/document/nodeBinding.ts:154` and `src/document/nodeBinding.ts:155`

Failure path:
- Catch block and error set: `src/document/nodeBinding.ts:157` to `src/document/nodeBinding.ts:163`

### Safest save insertion point
Recommended exact insertion point:
- Immediately after inferred title handling and before final success logs.
- Approx insertion anchor is after `setInferredTitle` block at `src/document/nodeBinding.ts:150`.

Why this point:
- Stale-doc guard already passed.
- Topology seam has already committed (`setTopology`).
- Canonical topology available from `getTopology`.
- Failure path is cleanly excluded.

Do not save:
- Before stale-doc check (`src/document/nodeBinding.ts:70`).
- Inside catch/finally (`src/document/nodeBinding.ts:157`, `src/document/nodeBinding.ts:164`).

## C) Canonical Save Payload (Schema Safety)

### Topology as canonical data
Canonical topology API:
- Setter seam: `src/graph/topologyControl.ts:203`
- Getter seam: `src/graph/topologyControl.ts:285`
- Returned shape from getter: `nodes`, `links`, `springs`: `src/graph/topologyControl.ts:287` to `src/graph/topologyControl.ts:290`

Topology type contract:
- `Topology.nodes` and `Topology.links`: `src/graph/topologyTypes.ts:46` to `src/graph/topologyTypes.ts:50`
- Node fields: `id`, `label`, `meta`: `src/graph/topologyTypes.ts:33` to `src/graph/topologyTypes.ts:36`
- Directed link fields: `id`, `from`, `to`, `kind`, `weight`, `meta`: `src/graph/topologyTypes.ts:20` to `src/graph/topologyTypes.ts:26`

Stable fields to store:
- `topology.nodes[].id`
- `topology.nodes[].label`
- `topology.nodes[].meta` (minimal only, keep small)
- `topology.links[]` directed link fields above

### What must not be stored
Do not persist engine transient physics state from `PhysicsNode`, such as:
- Position/velocity/forces: `x`, `y`, `vx`, `vy`, `fx`, `fy`
- Warm-start and per-frame caches
Reference type: `src/physics/types.ts` (PhysicsNode starts at line 6)

Do not persist raw document text from parsed docs:
- `ParsedDocument.text`: `src/document/types.ts:12`

Reason:
- Large payload, privacy risk, not needed to reconstruct map semantics.

## D) localStorage Store Design (Local First)

### Key
- `arnvoid_saved_interfaces_v1`

Versioning reason:
- Allows future schema migration without breaking older saved data.

### Proposed record schema

```ts
interface SavedInterfaceRecordV1 {
  id: string;
  createdAt: number;
  updatedAt: number;
  docId: string | null;
  title: string;
  topology: {
    nodes: Array<{ id: string; label?: string; meta?: Record<string, unknown> }>;
    links: Array<{
      id?: string;
      from: string;
      to: string;
      kind?: string;
      weight?: number;
      meta?: Record<string, unknown>;
    }>;
  };
  preview: {
    nodeCount: number;
    linkCount: number;
  };
  dedupeKey: string;
}
```

### Dedupe policy decision
Pick: `docId + topology hash` upsert policy (recommended)

Reason:
- Prevents duplicate-save spam on repeated analyzer runs with identical result.
- Still allows new version when topology changes.
- Better UX than always-append for auto-save behavior.

Fallback rule if `docId` is missing:
- Use `topology hash` only.

### Cap policy
- Keep max 20 records (newest first)
- On write, trim tail beyond 20

Reason:
- Protects against localStorage quota exhaustion.
- Keeps sidebar list manageable.

### Existing localStorage precedent
- i18n storage usage: `src/i18n/lang.ts:14`, `src/i18n/lang.ts:25`, `src/i18n/lang.ts:45`

## E) Restore Path (Sidebar Click to Graph Reload)

### AppShell as mediator
Current AppShell has pending analysis mediation already:
- Pending state: `src/screens/AppShell.tsx:62`
- Graph props wiring: `src/screens/AppShell.tsx:193` to `src/screens/AppShell.tsx:197`
- Sidebar mount point: `src/screens/AppShell.tsx:236`

Plan:
- Add local saved-interface state in AppShell.
- Add a new pending load intent pattern similar to `pendingAnalysisPayload`.

Minimal AppShell state additions:
- `savedInterfaces: SavedInterfaceRecordV1[]`
- `pendingLoadInterface: SavedInterfaceRecordV1 | null`
- `onPendingLoadInterfaceConsumed: () => void`

### Graph consumption model
Graph currently consumes pending analysis intent via effect:
- Payload type: `src/playground/GraphPhysicsPlayground.tsx:43`
- Consume effect: `src/playground/GraphPhysicsPlayground.tsx:581`
- Existing one-time consume callback usage: `src/playground/GraphPhysicsPlayground.tsx:615`, `src/playground/GraphPhysicsPlayground.tsx:648`

Plan:
- Add a second intent effect in graph for pending interface load.
- Restore strictly through topology seam:
- `setTopology`: `src/graph/topologyControl.ts:203`
- then `getTopology` and spring-to-physics rewiring pattern already used in graph:
- `src/playground/GraphPhysicsPlayground.tsx:543`, `src/playground/GraphPhysicsPlayground.tsx:548`, `src/playground/GraphPhysicsPlayground.tsx:565`

### Spawn overwrite risk and sequencing
Default spawn currently runs on mount:
- `spawnGraph(4, 1337)`: `src/playground/GraphPhysicsPlayground.tsx:578`

Risk:
- If load-intent is consumed before/after wrong phase, spawn can overwrite loaded topology.

Planned sequencing options:
1. Gate default spawn when `pendingLoadInterface` exists (preferred).
2. Or always apply load intent after spawn with explicit one-shot ordering guard.

Preferred:
- Option 1 is cleaner and avoids unnecessary topology churn.

## F) Conflicts and Risks

1. Duplicate save spam
- Cause: repeated analysis with same output.
- Control: dedupe upsert by `docId + topology hash`.

2. Stale/race writes
- Cause: async analyzer results arriving for old doc.
- Existing stale guard: `src/document/nodeBinding.ts:70` to `src/document/nodeBinding.ts:75`
- Control: save only after this guard and after seam apply.

3. localStorage size pressure
- Cause: unbounded records.
- Control: keep max 20, minimal payload, no raw text.

4. Pointer leaks from list click to canvas
- Existing root shielding: `src/components/Sidebar.tsx:104` to `src/components/Sidebar.tsx:106`
- Control: keep wrapper shielding and ensure list buttons do not bypass it.

5. Topology seam bypass risk
- Control: restore must use `setTopology`/`patchTopology` only.

## ASCII Flow Diagram

```text
[EnterPrompt/File Drop]
        |
        v
[GraphPhysicsPlayground pendingAnalysis consume]
        |
        v
[applyAnalysisToNodes]
  - analyzeDocument
  - stale-doc guard pass
  - setTopology (seam)
  - getTopology (canonical snapshot)
  - setInferredTitle
        |
        v
[save snapshot to localStorage]
        |
        v
[AppShell loads saved list]
        |
        v
[Sidebar "Your Interfaces" newest-first list]
        |
   (click item)
        v
[AppShell sets pendingLoadInterface]
        |
        v
[GraphPhysicsPlayground consume load intent]
  - setTopology (seam)
  - derive springs / rewire engine links
  - reset lifecycle
        |
        v
[Restored map visible]
```

## Minimal-Diff Files to Edit (Implementation Later)

1. `src/document/nodeBinding.ts`
- Add save trigger on success path.

2. `src/components/Sidebar.tsx`
- Replace mock list with props-driven list.
- Add `onSelectInterface` click behavior.

3. `src/screens/AppShell.tsx`
- Own saved list state and pending load intent.
- Wire Sidebar props and Graph props.

4. `src/playground/GraphPhysicsPlayground.tsx`
- Add pending load intent consumption.
- Gate or reorder default spawn to avoid overwrite.

5. New file (recommended): `src/store/savedInterfacesStore.ts`
- localStorage read/write, parse guard, versioning, dedupe, cap trim.

## Recommended Save Trigger (Exact)

Primary recommendation:
- In `src/document/nodeBinding.ts`, after inferred title set block (`src/document/nodeBinding.ts:150`) and before final success logs (`src/document/nodeBinding.ts:154`).

Rationale:
- This is the earliest point where map is canonical, current-doc validated, and successful.

## Restore Sequencing Plan (Avoid Spawn Overwrite)

Plan:
1. AppShell sends `pendingLoadInterface` when user clicks sidebar item.
2. Graph mount logic checks pending load intent before default spawn.
3. If load intent exists, skip `spawnGraph(4,1337)` path.
4. Consume load intent once, apply topology via seam, then clear intent.

Anchor refs:
- Default spawn effect: `src/playground/GraphPhysicsPlayground.tsx:576` to `src/playground/GraphPhysicsPlayground.tsx:579`
- Pending analysis consume pattern to mimic: `src/playground/GraphPhysicsPlayground.tsx:581` to `src/playground/GraphPhysicsPlayground.tsx:735`

## Manual Test Checklist

1. Analyze text input once, verify new record appears in Sidebar immediately.
2. Analyze same text again with same topology, verify dedupe updates existing record (no duplicate row).
3. Analyze different document, verify newest-first order.
4. Refresh browser, verify list persists from localStorage.
5. Click saved item from Sidebar on graph screen, verify map restores correctly.
6. Verify restore path uses topology seam (no direct topology object mutation outside control API).
7. Verify default spawn does not overwrite restored map on load.
8. Force analysis failure, verify no new saved record is created.
9. Check sidebar clicks do not trigger canvas drag/pointer side effects.
10. Verify record cap trims oldest items beyond 20.

## Final Forensic Verdict

- Feature is straightforward in local-first mode and aligned with current architecture.
- Correct save point is in `applyAnalysisToNodes` success path after seam apply.
- Correct restore ownership is AppShell-mediated intent plus Graph seam application.
- Main implementation risks are sequencing (spawn overwrite) and dedupe correctness, both manageable with minimal diffs.

## Step 2 Implementation Spec (savedInterfacesStore)

Module:
- `src/store/savedInterfacesStore.ts`

Versioned key:
- `SAVED_INTERFACES_KEY = "arnvoid_saved_interfaces_v1"`

Exact schema:
- `SavedInterfaceRecordV1`
- Fields:
  - `id`, `createdAt`, `updatedAt`
  - `title`, `docId`, `source`, `fileName?`, `mimeType?`
  - `parsedDocument: ParsedDocument` (full payload, including `text`, `warnings`, `meta`)
  - `topology: Topology` (full payload)
  - `analysisMeta?: any` (untrimmed)
  - `preview: { nodeCount, linkCount, charCount, wordCount }`
  - `dedupeKey`

Dedupe rule:
- Single rule chosen: `docId::hash(canonical({ title, topology }))`
- Hash is deterministic, non-crypto (djb2-style), no external dependency.
- Upsert behavior:
  - if dedupe key exists: replace full payload and bump `updatedAt`
  - if not: insert as newest

Cap behavior:
- Default cap: 20 records (`DEFAULT_SAVED_INTERFACES_CAP = 20`)
- Always keep newest-first by `updatedAt` desc then `createdAt` desc
- Trim oldest records beyond cap

Quota failure behavior:
- On localStorage write failure (including quota), fail gracefully
- Log exactly one line:
  - `[savedInterfaces] localStorage_quota_exceeded`
- No throw, no app crash

## Step 3 Update (Save Trigger at Analysis Success)

Insertion point (exact):
- `src/document/nodeBinding.ts:161` to `src/document/nodeBinding.ts:213`
- Trigger is inside `applyAnalysisToNodes(...)` success path, after:
  - stale-doc guard pass: `src/document/nodeBinding.ts:77` to `src/document/nodeBinding.ts:83`
  - topology seam apply + canonical read: `src/document/nodeBinding.ts:137` to `src/document/nodeBinding.ts:143`
  - inferred title compute/set: `src/document/nodeBinding.ts:155` to `src/document/nodeBinding.ts:159`

Saved payload now:
- `parsedDocument` is persisted with full `text` and full `meta` object fields present in this path.
- `topology` is persisted from canonical seam snapshot (`getTopology()`), untrimmed.
- `preview` uses topology counts plus parsed document char/word counts.
- `upsertSavedInterface(...)` is used for dedupe + cap handling.

Non-run conditions confirmed:
- Stale guard early return path does not save: `src/document/nodeBinding.ts:77` to `src/document/nodeBinding.ts:83`
- Failure path does not save (no save call in catch/finally): `src/document/nodeBinding.ts:218` to `src/document/nodeBinding.ts:227`

Logging:
- Success-only dev log added once per successful trigger:
  - `[savedInterfaces] upsert ok id=... docId=... nodes=... links=...`

## Step 4 Update (Sidebar Props-Driven List)

Changed file:
- `src/components/Sidebar.tsx`

New props:
- `interfaces?: Array<{ id: string; title: string; subtitle?: string; nodeCount?: number; linkCount?: number; updatedAt?: number }>`
- `selectedInterfaceId?: string`
- `onSelectInterface?: (id: string) => void`

Rendering behavior:
- Sidebar now renders `interfaces` from props as-is (no internal sorting).
- If `interfaces` is missing or empty, inline empty-state line is shown under "Your Interfaces":
  - `No saved interfaces yet.`
- Clicking an item calls `onSelectInterface(id)`.

Input shielding:
- Existing sidebar shielding remains intact (`onPointerDown` / wheel stop on root).
- Interface list item buttons also stop `pointerdown` propagation to keep canvas isolated.

## Step 5 Update (AppShell Owns List + Pending Restore Intent)

Changed file:
- `src/screens/AppShell.tsx`

State added in AppShell:
- `savedInterfaces: SavedInterfaceRecordV1[]`
- `pendingLoadInterface: SavedInterfaceRecordV1 | null`

List loading:
- `loadSavedInterfaces()` is called on mount and stored in `savedInterfaces`.

Sidebar population:
- AppShell maps `savedInterfaces` to `SidebarInterfaceItem[]` and passes:
  - `interfaces={sidebarInterfaces}`
  - `selectedInterfaceId={pendingLoadInterface?.id ?? undefined}`
  - `onSelectInterface={(id) => ...}`
- On select:
  - find record by id
  - set `pendingLoadInterface`
  - log: `[appshell] pending_load_interface id=%s`

Graph pass-through props (no consumption yet):
- AppShell now passes to Graph:
  - `pendingLoadInterface={pendingLoadInterface}`
  - `onPendingLoadInterfaceConsumed={() => setPendingLoadInterface(null)}`
- Graph consumption is intentionally deferred to step 6.

Refresh strategy used now:
- Simple trigger chosen: refresh localStorage-backed list whenever screen becomes `graph`.
- This is implemented via AppShell effect on `screen` transitions (`screen === 'graph'`).

## Step 6 Update (Graph Consumes Pending Restore Intent)

Changed file:
- `src/playground/GraphPhysicsPlayground.tsx`

Effect location + readiness gate:
- Pending restore consume effect starts at `src/playground/GraphPhysicsPlayground.tsx:602`
- Gate conditions:
  - `pendingLoadInterface` exists (`src/playground/GraphPhysicsPlayground.tsx:603`)
  - one-shot guard not consumed (`src/playground/GraphPhysicsPlayground.tsx:604`)
  - engine exists (`src/playground/GraphPhysicsPlayground.tsx:605`)
  - AI not active (`src/playground/GraphPhysicsPlayground.tsx:606`)

One-shot + pre-clear mechanism:
- One-shot refs:
  - `hasConsumedLoadRef` (`src/playground/GraphPhysicsPlayground.tsx:102`)
  - `lastPendingLoadIdRef` reset effect (`src/playground/GraphPhysicsPlayground.tsx:595`)
- Consume order in effect:
  1. set guard true (`src/playground/GraphPhysicsPlayground.tsx:608`)
  2. log consume (`src/playground/GraphPhysicsPlayground.tsx:610`)
  3. pre-clear via `onPendingLoadInterfaceConsumed()` BEFORE restore work (`src/playground/GraphPhysicsPlayground.tsx:611`)
  4. restore sequence
  5. done log ok=true/false (`src/playground/GraphPhysicsPlayground.tsx:664`, `src/playground/GraphPhysicsPlayground.tsx:667`)

Restore order (full payload, no trimming):
1. `documentContext.setDocument(rec.parsedDocument)` using full saved parsed document (`src/playground/GraphPhysicsPlayground.tsx:618`)
2. set inferred title from saved title (`src/playground/GraphPhysicsPlayground.tsx:619`)
3. apply topology through seam: `setTopology(rec.topology, ...)` (`src/playground/GraphPhysicsPlayground.tsx:623`)
4. canonical topology read + spring derivation fallback (`src/playground/GraphPhysicsPlayground.tsx:624` to `src/playground/GraphPhysicsPlayground.tsx:628`)
5. engine rewiring from restored topology-derived links (`src/playground/GraphPhysicsPlayground.tsx:659` to `src/playground/GraphPhysicsPlayground.tsx:662`)

Spawn overwrite gating decision:
- Default spawn is now gated to run only once and skipped if pending load exists at startup:
  - guard ref `hasSpawnedInitialGraphRef` (`src/playground/GraphPhysicsPlayground.tsx:101`)
  - spawn gate effect (`src/playground/GraphPhysicsPlayground.tsx:584` to `src/playground/GraphPhysicsPlayground.tsx:593`)
- This prevents default spawn from overriding restored topology in pending-load startup cases.

Error behavior:
- Invalid/missing topology or restore exception sets calm error:
  - `Failed to load saved interface.` (`src/playground/GraphPhysicsPlayground.tsx:666`)
- No crash; effect is one-shot guarded and does not loop retries.

## Step 6.1 Hardening Update (Race Guard + Metadata Rehydration)

Changed file:
- `src/playground/GraphPhysicsPlayground.tsx`

Race hardening:
- Added restore lock ref: `isRestoringRef` (`src/playground/GraphPhysicsPlayground.tsx:103`)
- Restore effect sets lock true at consume start (`src/playground/GraphPhysicsPlayground.tsx:610`) and resets in `finally` (`src/playground/GraphPhysicsPlayground.tsx:686`)
- Pending analysis effect now exits early when:
  - `pendingLoadInterface` exists (`src/playground/GraphPhysicsPlayground.tsx:700`)
  - restore is in progress (`src/playground/GraphPhysicsPlayground.tsx:701`)
- This prevents analysis consume from overriding a restore in progress.

Metadata rehydration on restored dots:
- During restore node rebuild, each `PhysicsNode.meta` is populated with:
  - `docId`
  - `sourceTitle`
  - `sourceSummary`
- Source priority:
  - prefer values from saved topology node meta if present
  - fallback to saved record title/label and full `parsedDocument.text`
- Anchors:
  - title/summary selection: `src/playground/GraphPhysicsPlayground.tsx:648` to `src/playground/GraphPhysicsPlayground.tsx:652`
  - meta assignment: `src/playground/GraphPhysicsPlayground.tsx:668` to `src/playground/GraphPhysicsPlayground.tsx:671`

Integrity note:
- Restore still uses full payload from saved record:
  - `documentContext.setDocument(rec.parsedDocument)` unchanged
  - `setTopology(rec.topology)` through seam unchanged
- No payload trimming introduced.

## Step 7.1 Hardening Update (Spawn/Restore Race + Metadata Safety)

Changed file:
- `src/playground/GraphPhysicsPlayground.tsx`

Centralized default spawn gate:
- Init refs now separate decision and execution:
  - `hasInitDecisionRef`: `src/playground/GraphPhysicsPlayground.tsx:101`
  - `hasDefaultSpawnRunRef`: `src/playground/GraphPhysicsPlayground.tsx:102`
  - `hasRestoredSuccessfullyRef`: `src/playground/GraphPhysicsPlayground.tsx:104`
  - `pendingRestoreAtInitRef`: `src/playground/GraphPhysicsPlayground.tsx:105`
- Pending restore intent is latched before init decision:
  - `src/playground/GraphPhysicsPlayground.tsx:588` to `src/playground/GraphPhysicsPlayground.tsx:591`
- Explicit gate:
  - `shouldRunDefaultSpawn = !pendingRestoreAtInitRef.current && !pendingLoadInterface && !hasRestoredSuccessfullyRef.current`
  - `src/playground/GraphPhysicsPlayground.tsx:611` to `src/playground/GraphPhysicsPlayground.tsx:613`

One-shot spawn run and diagnostics:
- New single-run helper `runDefaultSpawnOnce(...)`: `src/playground/GraphPhysicsPlayground.tsx:594` to `src/playground/GraphPhysicsPlayground.tsx:606`
- Logs (once):
  - skip: `[graph] default_spawn_skipped reason=pending_restore` at `src/playground/GraphPhysicsPlayground.tsx:617`
  - run: `[graph] default_spawn_run seed=1337` at `src/playground/GraphPhysicsPlayground.tsx:602`
  - fallback: `[graph] default_spawn_fallback reason=restore_failed` at `src/playground/GraphPhysicsPlayground.tsx:600`

Restore hardening and failure fallback:
- Restore effect now guards against overlap:
  - `if (isRestoringRef.current) return;` at `src/playground/GraphPhysicsPlayground.tsx:635`
- Restore success marker is set only after topology apply + engine rewire complete:
  - `hasRestoredSuccessfullyRef.current = true` at `src/playground/GraphPhysicsPlayground.tsx:711`
- If restore fails and graph is still empty, fallback default spawn runs once:
  - `src/playground/GraphPhysicsPlayground.tsx:720` to `src/playground/GraphPhysicsPlayground.tsx:725`

Metadata safety update:
- Full `parsedDocument` is still restored into DocumentContext (unchanged).
- Dot popup fallback summary no longer duplicates full document text per node.
- New fallback summary is lightweight:
  - `const fallbackSummary = \`Saved interface: ${fallbackTitle}\`;`
  - `src/playground/GraphPhysicsPlayground.tsx:667`
- This keeps document viewer integrity (full text remains in document store) while avoiding per-node full-text replication.

## Step 7 Update (Default Spawn Hardening)

Changed file:
- `src/playground/GraphPhysicsPlayground.tsx`

Centralized default spawn gate:
- Added one-shot decision ref: `hasDefaultSpawnDecisionRef`
- Added session restore marker: `hasRestoredRef`
- Single derived gate boolean in init effect:
  - `shouldRunDefaultSpawn = !pendingLoadInterface && !hasRestoredRef.current`
- Effect now depends on `pendingLoadInterface` and finalizes decision exactly once.

Behavior:
- If `shouldRunDefaultSpawn` is false, default spawn never runs.
- If true, default spawn runs once with seed 1337.

Diagnostics (one-shot, dev-only):
- Skip log: `[graph] default_spawn_skipped reason=pending_restore`
- Run log: `[graph] default_spawn_run seed=1337`

Why this is StrictMode-safe:
- `hasDefaultSpawnDecisionRef` finalizes spawn decision once per component session.
- Even if effects are invoked twice in dev StrictMode, second invocation exits early.

Multiple saved-interface clicks behavior:
- `hasRestoredRef.current` is set when a restore is consumed.
- Once a restore has happened in the session, default spawn path remains permanently blocked.
- Repeated clicks on different saved interfaces only drive restore flow; they cannot re-enable default spawn.
