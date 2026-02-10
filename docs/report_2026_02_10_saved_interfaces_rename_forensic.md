# Forensic Report: Saved Interface Rename (LocalStorage)

Date: 2026-02-10  
Scope: Forensic only (no code implementation)

## Root Summary
Rename is feasible with local-only changes, but there is a critical identity hazard: current dedupe key generation includes `title`, so a renamed record can fail to match later upserts and produce duplicates. The rename flow should mutate `SavedInterfaceRecordV1.title` via a store helper and refresh AppShell state immediately. To keep identity stable, dedupe must be title-independent (doc + topology), or upsert must support legacy key fallback.

## 1) Data contract: where displayed title comes from

- Sidebar rows render `SidebarInterfaceItem.title`:
  - `src/components/Sidebar.tsx:17`
  - row text render: `src/components/Sidebar.tsx:307`
- AppShell maps `SavedInterfaceRecordV1.title` into sidebar item title:
  - `src/screens/AppShell.tsx:123`
  - mapping uses `title: record.title`: `src/screens/AppShell.tsx:127`
- Graph restore consumes saved record title:
  - restore applies inferred title from saved session title: `documentContext.setInferredTitle(rec.title)` at `src/playground/GraphPhysicsPlayground.tsx:818`
  - fallback title also prefers `rec.title`: `src/playground/GraphPhysicsPlayground.tsx:832`

Implication:
- Renaming `record.title` is enough for sidebar display and restore title parity.

## 2) Persistence layer: required mutation surface

`SavedInterfaceRecordV1` fields:
- identity/display: `id`, `title`, `docId`, timestamps
- payload: `parsedDocument`, `topology`, `analysisMeta`, `layout`, `camera`, `preview`, `dedupeKey`
- definition: `src/store/savedInterfacesStore.ts:19-46`

Current mutation helpers:
- `upsertSavedInterface(...)`: `src/store/savedInterfacesStore.ts:281`
- `patchSavedInterfaceLayout(...)`: `src/store/savedInterfacesStore.ts:327`
- `deleteSavedInterface(...)`: `src/store/savedInterfacesStore.ts:320`
- no title patch helper exists

Recommended new helper:
- `patchSavedInterfaceTitle(id: string, newTitle: string): SavedInterfaceRecordV1[]`
- behavior:
  - load current list
  - find by `id`
  - set `title` and `updatedAt`
  - persist via `saveAllSavedInterfaces`
  - return refreshed list
  - keep `dedupeKey` unchanged on rename

Validation/backward compatibility:
- record validation requires `title` string and optional legacy fields:
  - `title` check: `src/store/savedInterfacesStore.ts:122`
  - optional `analysisMeta/layout/camera`: `src/store/savedInterfacesStore.ts:141-143`

## 3) Dedupe + identity hazards (critical)

Current dedupe key builder includes title:
- signature includes `title`: `src/store/savedInterfacesStore.ts:232-236`
- canonical hash object includes `title`: `src/store/savedInterfacesStore.ts:237-240`
- key format: `${docId}::${hash}`: `src/store/savedInterfacesStore.ts:242`
- upsert match uses `item.dedupeKey === record.dedupeKey`: `src/store/savedInterfacesStore.ts:289`

Save trigger currently computes dedupe with inferred interface title:
- `src/document/nodeBinding.ts:207-211`

Hazard:
- if title changes, dedupe key changes for same topology/doc, and future upsert can insert duplicates.

Recommended dedupe resolution:
1. Target rule: dedupe key must ignore title and be based on stable identity:
   - `docId + topology hash` (or stronger stable identity if needed)
2. Rename must never rewrite `dedupeKey`.
3. For compatibility with existing records:
   - upsert should support legacy matching path for old keys or migration strategy so old titled keys still converge.

## 4) Immediate UI refresh path after rename

Current list ownership:
- AppShell owns `savedInterfaces` state: `src/screens/AppShell.tsx:67`
- refresh function: `refreshSavedInterfaces()` loads from storage: `src/screens/AppShell.tsx:107-109`
- sidebar list is derived from state: `src/screens/AppShell.tsx:123-134`
- sidebar currently gets list + select callback only: `src/screens/AppShell.tsx:274-296`

Recommended least-diff update route:
- keep AppShell as source of truth and add rename callback down to Sidebar:
  - `onRenameInterface?: (id: string, newTitle: string) => void`
- AppShell callback flow:
  - call `patchSavedInterfaceTitle(id, newTitle)`
  - call `refreshSavedInterfaces()` immediately

Reason:
- avoids introducing new event bus/polling
- matches existing architecture where AppShell owns rendered sidebar list.

## 5) Rename UX options and recommended flow

Current menu scaffolding is in `Sidebar.tsx`:
- ellipsis + row menu state and popup render:
  - state: `src/components/Sidebar.tsx:93-97`
  - popup render: `src/components/Sidebar.tsx:354-397`
  - outside click + Escape close: `src/components/Sidebar.tsx:151-178`

Recommended UX (Sidebar-local, minimal):
1. User clicks Rename in popup -> switch that row into rename mode.
2. Show anchored inline input (same popup surface or row inline editor) with auto-focus.
3. Keyboard:
   - Enter: confirm
   - Escape: cancel
4. Click-outside:
   - cancel rename (safer, non-destructive)
5. Sanitization:
   - trim
   - collapse whitespace
   - max length (for example 120)
   - empty result -> fallback `Untitled Interface`
6. Preserve selection semantics:
   - editing interactions must not trigger `onSelectInterface`.

Minimum additional state (Sidebar):
- `renamingRowId: string | null`
- `renameDraft: string`
- optional `renameInputRef`

## 6) Edge-case handling checklist

1. Renaming selected/open interface while graph is active:
- sidebar title updates immediately
- restore identity remains by `id`/dedupe rule, not title text

2. Menu open + list scroll:
- popup is fixed-position already (`src/components/Sidebar.tsx:692`)
- if scroll occurs during rename/menu open, keep behavior deterministic (close menu or recompute anchor in later enhancement)

3. Long titles:
- row already truncates via text container (`src/components/Sidebar.tsx:661-668`)

4. Unicode/emoji:
- keep as normal strings; no ASCII-only restriction for user data

5. Storage safety:
- rename is a small metadata write; low quota risk
- existing quota handling already logs and avoids crash:
  - `src/store/savedInterfacesStore.ts:277`

## Recommended code touch points (implementation phase)

1. `src/store/savedInterfacesStore.ts`
- add `patchSavedInterfaceTitle(...)`
- optionally harden dedupe strategy to remove title-dependency with compatibility path

2. `src/screens/AppShell.tsx`
- add `onRenameInterface` callback to Sidebar props
- call store helper + `refreshSavedInterfaces()`

3. `src/components/Sidebar.tsx`
- add rename interaction state + input UX
- wire Rename menu item to invoke callback
- keep pointer/wheel shielding intact

## Done-tests checklist (post implementation)

1. Rename from menu updates row title immediately.
2. Reload app; renamed title persists.
3. Click renamed row; restore still works.
4. No duplicate records created after future analysis save of same interface.
5. Enter confirms rename, Escape cancels.
6. Click outside during rename behaves per chosen policy (recommended: cancel).
7. Pointer/wheel over menu/input never leaks to canvas.

## Step 1 Implemented

- Added storage helper:
  - `patchSavedInterfaceTitle(id: string, newTitle: string): SavedInterfaceRecordV1[]`
  - file: `src/store/savedInterfacesStore.ts`
- Behavior:
  - loads current list, finds record by `id`, updates only `title` and `updatedAt`, persists, returns newest-first list.
  - if `id` not found: returns unchanged list.
- Identity safety:
  - helper does not mutate `dedupeKey` or any other identity fields.
- Sanitization policy:
  - no trimming/sanitizing in store layer; UI layer will sanitize title input later.

## Step 4 Verified

- Sidebar display parity is correct:
  - AppShell maps saved records with `title: record.title` into sidebar rows in `src/screens/AppShell.tsx:131`.
  - rename flow refreshes from storage immediately in `src/screens/AppShell.tsx:290-293`.
- Restore parity is correct:
  - restore path sets inferred title from saved record title via `documentContext.setInferredTitle(rec.title)` in `src/playground/GraphPhysicsPlayground.tsx:818`.
  - fallback summary path also prefers renamed title through `fallbackTitle = rec.title || ...` in `src/playground/GraphPhysicsPlayground.tsx:832`.
- No rename side effects on core payload:
  - rename patch updates title and timestamp only; no mutation to parsed document text/meta, topology/layout/camera, analysis meta, or dedupe key.
- Outcome:
  - no behavioral patch required for title parity in this step; docs verification only.

## Rename Ordering Fix Implemented

- File updated: `src/store/savedInterfacesStore.ts`.
- `patchSavedInterfaceTitle(id, newTitle)` now mutates only `title`.
- `updatedAt` is no longer changed during rename, so list order remains stable after `refreshSavedInterfaces()`.
- Sort semantics are unchanged for real save/upsert events:
  - `loadSavedInterfaces()` and `saveAllSavedInterfaces()` still sort newest-first by `updatedAt` then `createdAt`.
- Identity and payload safety preserved:
  - no mutation to `dedupeKey`, `parsedDocument`, `topology`, `layout`, `camera`, or `analysisMeta`.
