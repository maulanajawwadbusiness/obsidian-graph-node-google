# Docs Sync Report: Graph Loading Step 1-9 (2026-02-16)

## Scope
- Docs-only sync.
- Updated:
  - `docs/system.md`
  - `docs/repo_xray.md`
  - `docs/FUTURE_TODO.md`
- No runtime or TypeScript code changes.

## What Was Updated

### 1) `docs/system.md`
- Updated flow and screen ownership language to include `graph_loading` in the main spine:
  - `welcome1 -> welcome2 -> prompt -> graph_loading -> graph`
- Updated onboarding/graph-class boundary text:
  - graph runtime now documented as graph-class (`graph_loading` + `graph`) warm-mounted branch.
- Updated onboarding route wording in screen sections:
  - `Welcome2` skip and `EnterPrompt` enter/skip now documented as graph-loading path.
- Updated saved-interface restore wording:
  - prompt restore/select now documented as `graph_loading` first, then Confirm-gated graph reveal.
- Updated sidebar mode wording:
  - sidebar overlay presence now documented on `prompt`, `graph_loading`, `graph`.
- Added dedicated section:
  - `## 2.7 Graph Loading Gate (2026-02-15/16)`
  - Covers gate purpose, warm-mount model, UI surface, phase model, input shielding, focus/keyboard ownership, sidebar frozen behavior, legacy loading suppression, and DEV debug hooks.
- Renumbered previous runtime lease section to `## 2.8`.

### 2) `docs/repo_xray.md`
- Added update note:
  - `Update Note: 2026-02-16 (Graph Loading Real Screen, Steps 1-9)`
  - Documents screen union, prompt forward routing, shared graph-class branch, real gate surface, gate state model, legacy loading suppression, sidebar frozen policy, and keyboard capture policy.
- Updated graph topology section (`0.2`):
  - Render seam now shown as `renderScreenContent(screen='graph_loading'|'graph')`.
  - Added `GraphLoadingGate` overlay layer in ASCII tree.
  - Updated notes for product Sidebar presence on `prompt`, `graph_loading`, and `graph`.
  - Added warm-mount and legacy loading suppression notes.

### 3) `docs/FUTURE_TODO.md`
- Appended new backlog section:
  - `## Graph Loading Polish Backlog`
- Added requested five items:
  1. Sidebar frozen look polish (dim icons/avatar only).
  2. Keyboard keys issue on loading screen.
  3. Loading screen typography weight 300.
  4. 200ms fade in/out for loading screen.
  5. General loading screen polish.

## End Checklist
- `system.md` flow and screen ownership matches current graph-loading architecture and ownership seams.
- `repo_xray.md` graph topology section matches current graph-class render seams and gate layer ownership.
- `FUTURE_TODO.md` contains the five requested graph-loading backlog items.
