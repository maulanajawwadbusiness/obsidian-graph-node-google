# Forensic Report: Sidebar Saved Interfaces (LocalStorage First)

Date: 2026-02-10
Scope: Forensic scan only. No implementation changes.
Requested target: Save analyzed graph map into Sidebar "Your Interfaces" so it can be reopened later without re-analyzing.

## 1. Executive Summary

Current state:
- Sidebar "Your Interfaces" is mock-only and not connected to real graph data.
- Paper analyzer pipeline already produces stable graph semantics (dots + directed links) and writes through the required topology seam.
- There is currently no persistence path for graph/interface snapshots in frontend state or backend DB.

Conclusion:
- The correct local-first strategy is to persist a graph snapshot after analysis success, then bind Sidebar list to that snapshot store.
- The safest payload to persist is topology plus minimal metadata (title/docId/timestamp), not raw engine internals.
- Reopen path should restore graph via topology seam (`setTopology`), then rewire engine from derived springs.

## 2. What Exists Today (Evidence)

### 2.1 Sidebar is mock-only
- Mock list source: `src/components/Sidebar.tsx:12`
- Section render: `src/components/Sidebar.tsx:180`, `src/components/Sidebar.tsx:183`, `src/components/Sidebar.tsx:185`
- No persistence hooks in Sidebar props/state.

Implication:
- "Your Interfaces" currently cannot reflect real graph outputs.

### 2.2 Analyzer output already has reusable map semantics
- Analyzer returns `paperTitle`, `points`, `links`: `src/ai/paperAnalyzer.ts:256`, `src/ai/paperAnalyzer.ts:364`
- Analysis call in bind step: `src/document/nodeBinding.ts:67`
- Directed links and node labels are assembled in bind step, then topology is mutated via seam:
  - `setTopology(...)`: `src/document/nodeBinding.ts:130`
  - `getTopology()` snapshot after mutation: `src/document/nodeBinding.ts:135`
- Inferred title already surfaced to UI state:
  - `setInferredTitle(...)`: `src/document/nodeBinding.ts:150`

Implication:
- End of `applyAnalysisToNodes` is the best semantic completion point for "map is ready to save".

### 2.3 Topology mutation seam is enforced and suitable for restore
- Canonical setter: `src/graph/topologyControl.ts:203`
- Canonical getter: `src/graph/topologyControl.ts:285`
- Patch path: `src/graph/topologyControl.ts:677`

Implication:
- Restore must go through topology seam (non-negotiable rule from doctrine).

### 2.4 Graph ingestion flow from onboarding/prompt
- Pending payload is set in shell:
  - text: `src/screens/AppShell.tsx:222`
  - file: `src/screens/AppShell.tsx:226`
- Payload consumed in graph playground:
  - text branch starts: `src/playground/GraphPhysicsPlayground.tsx:594`
  - file branch starts: `src/playground/GraphPhysicsPlayground.tsx:642`
  - analyzer invoke: `src/playground/GraphPhysicsPlayground.tsx:622`, `src/playground/GraphPhysicsPlayground.tsx:690`

Implication:
- Existing one-way flow is "prompt/file -> analyze -> graph".
- No reverse flow yet for "sidebar click -> load saved map".

### 2.5 Existing local persistence precedent in frontend
- i18n uses localStorage (`arnvoid_lang`): `src/i18n/lang.ts:14`, `src/i18n/lang.ts:25`, `src/i18n/lang.ts:45`

Implication:
- localStorage usage pattern already accepted in this codebase.

### 2.6 Backend state for map history does not exist yet
- No map/interface save tables present in migrations list under `src/server/migrations`.
- `docs/FUTURE_TODO.md` already tracks map/history persistence as future work.

Implication:
- localStorage-first is aligned with current repository state and your "backend later" directive.

## 3. Forensic Dataflow Map (Current)

Actual flow now:
1. User submits text/file in prompt screen.
2. `AppShell` stores transient `pendingAnalysisPayload`.
3. `GraphPhysicsPlayground` consumes payload once and calls `applyAnalysisToNodes`.
4. `applyAnalysisToNodes`:
   - calls analyzer,
   - applies labels/meta to dots,
   - builds directed links,
   - calls `setTopology` seam,
   - rebuilds engine links from springs,
   - sets inferred title,
   - exits.
5. No snapshot persistence occurs.
6. Sidebar still renders `MOCK_INTERFACES`.

Persistence gap:
- The map exists in memory and topology state, but is dropped on reload/new session.

## 4. Where Save Should Happen (LocalStorage-First)

Recommended save trigger (analysis pipeline end):
- Primary insertion point: inside `applyAnalysisToNodes` after successful topology apply and before function return.
- Reason:
  - Analysis is validated and gate-checked (doc race checked).
  - Topology has been normalized by seam.
  - Inferred title exists for user-facing naming.

Alternative trigger:
- Save from `GraphPhysicsPlayground` immediately after `await applyAnalysisToNodes(...)` resolves.
- Tradeoff:
  - Slightly cleaner separation from document binding, but requires extra data plumbing to reconstruct save payload.

Forensic recommendation:
- Primary point remains `src/document/nodeBinding.ts` success path, because all required map semantics are present there already.

## 5. What Should Be Saved (Schema For Local)

Minimum viable saved interface record:
- `id`: unique local interface id.
- `createdAt`: epoch ms.
- `updatedAt`: epoch ms.
- `docId`: analysis doc id.
- `title`: inferred title fallback chain (`paperTitle -> first point -> doc/file name -> "Untitled Interface"`).
- `topology`:
  - `nodes` (id, label, meta minimal),
  - `links` (directed links with id/from/to/kind/weight/meta).
- `preview` (optional): node count, link count.

Do not save:
- Full raw document text (large + sensitive).
- Physics transient state (`vx`, `vy`, warm-start caches, drag state).
- Auth/session data.

Storage key proposal:
- `arnvoid_saved_interfaces_v1`

Rationale:
- Versioned key prevents silent schema collisions in future revisions.

## 6. How Reopen Should Work (No Backend)

Restore pipeline target behavior:
1. Sidebar loads list from localStorage and displays newest-first in "Your Interfaces".
2. User clicks an item.
3. App state routes a "load saved interface" intent to graph container.
4. Graph applies topology through seam (`setTopology`), derives springs, rewires engine.
5. Document title/inferred title updates to saved interface title.

Important law alignment:
- Must not mutate topology directly.
- Must use `setTopology` or `patchTopology`.

## 7. Conflict and Risk Analysis

### 7.1 Race and stale write risk
Source:
- `applyAnalysisToNodes` has stale-doc gate: `src/document/nodeBinding.ts:70`

Risk:
- Saving outside this gate can persist stale analysis from old document.

Control:
- Save only after stale-doc guard passes and topology apply succeeds.

### 7.2 Duplicate save spam
Risk:
- Re-running analysis on same content creates many near-identical entries.

Control:
- Use deterministic dedupe fingerprint from topology nodes+links or `(docId + topology hash)` and upsert local item.

### 7.3 localStorage size quota
Risk:
- Browser localStorage is limited (~5MB class; browser dependent).

Control:
- Keep payload lean.
- Store only last N interfaces (for example 20).
- Drop oldest on overflow.

### 7.4 Sidebar input ownership and pointer safety
Source:
- Sidebar wrapper already stops pointer/wheel propagation: `src/components/Sidebar.tsx` root `<aside>`.

Risk:
- New clickable list actions may accidentally leak pointerdown to canvas if new nested controls are added incorrectly.

Control:
- Maintain current stopPropagation pattern on interactive elements.

### 7.5 Startup overwrite risk
Source:
- Graph currently spawns default topology on mount (`spawnGraph(4, 1337)`): `src/playground/GraphPhysicsPlayground.tsx:577`

Risk:
- Saved map load can be overwritten by default spawn if ordering is wrong.

Control:
- Ensure saved-load intent applies after initial spawn or gates spawn when a saved interface is being loaded.

### 7.6 Analyzer failure semantics
Source:
- On failure, graph unchanged + AI error set: `src/document/nodeBinding.ts` catch/finally.

Risk:
- Partial or failed analysis might still be saved if save hook is placed incorrectly.

Control:
- Save only on success path after topology is applied.

## 8. System Integration Plan (For Later Implementation)

### 8.1 Components/seams to touch
- `src/components/Sidebar.tsx`
  - Replace `MOCK_INTERFACES` with real props-based list.
- `src/screens/AppShell.tsx`
  - Add lifted state for saved interface list and selected interface intent.
- `src/playground/GraphPhysicsPlayground.tsx`
  - Accept and consume "load saved interface" intent.
- `src/document/nodeBinding.ts`
  - Emit/save snapshot after successful analysis completion.
- New local module (recommended):
  - `src/store/savedInterfacesStore.ts` (localStorage read/write, versioning, dedupe, cap).

### 8.2 Why this structure
- Keeps Sidebar presentational and avoids direct topology mutation from UI component.
- Keeps graph mutation in graph/domain layer where seam usage is already correct.
- Maintains minimal diffs and modularity doctrine.

## 9. Specific Technical Gaps Blocking Feature Today

1. No persistence model for interfaces.
2. No AppShell-level contract between Sidebar click and graph load action.
3. Sidebar data still hardcoded mock values.
4. No "save on successful analysis" event/hook.
5. No reopen path that reapplies topology from saved snapshot.

## 10. Validation Checklist (When Implementing)

1. Analyze text -> new item appears in Sidebar without refresh.
2. Refresh browser -> saved item still present.
3. Click saved item -> graph reloads that exact map.
4. Failed analysis does not create saved item.
5. Repeated analysis of same doc either dedupes or clearly versions (explicit policy).
6. Overlay/pointer behavior remains intact (sidebar clicks never drag canvas).
7. Topology mutation logs still show seam usage (`setTopology`), no direct mutation.

## 11. Final Forensic Verdict

Feasibility: High for localStorage-only phase.
Complexity: Moderate (cross-component wiring), low backend dependency.
Correct anchor point: end of `applyAnalysisToNodes` success path plus AppShell-Graph-Sidebar wiring.
Doctrine fit: Strong, as long as restore path goes through `setTopology` and pointer shielding is preserved.

---

No code implementation was performed in this report task.
