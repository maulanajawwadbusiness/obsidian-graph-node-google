# Report: B2 Nav Fade Run1 (2026-02-17)

## Scope
- Implement B2 only:
  - `graph -> sidebar select other saved graph -> 200ms content-only fade -> graph switch`.
- Reuse existing nav fade bedrock from B1 and B1-reverse.
- Keep analysis path and gate behavior unchanged.

## Files Changed
- `src/screens/AppShell.tsx`
- `docs/report_2026_02_17_b2_nav_fade_run1.md`

## Logic Summary
- Extended `PendingFadeAction` with:
  - `{ kind: 'switchGraph'; record: SavedInterfaceRecordV1 }`

- Updated `selectSavedInterfaceById`:
  - Prompt path unchanged (B1 forward).
  - New graph-class path for B2:
    - guard fade re-entry: `contentFadePhase === 'idle'`
    - guard ai activity: block when `graphRuntimeStatus.isLoading` and log `[B2Fade] blocked: aiActivity`
    - no-op guard: if selected id matches `pendingLoadInterface?.id`, return
    - enqueue fade action `switchGraph`
    - start fade out
    - log `[B2Fade] start ...`
  - No immediate `setPendingLoadInterface` for B2 trigger.

- Updated fade-out commit handler:
  - Added `switchGraph` case:
    - `setPendingLoadInterface(action.record)` (no screen transition)
    - log `[B2Fade] commit ...`
  - Existing actions (`restoreInterface`, `createNew`) unchanged.
  - Common flow still starts fade-in and then `[NavFade] done`.

## Sidebar Layer Proof
- Fade surface remains `ContentFadeOverlay` in non-sidebar layer.
- Fade overlay z-index is `40`.
- Sidebar layer z-index (`LAYER_SIDEBAR`) is `50` in `src/ui/layers.ts`.
- Therefore sidebar stays above fade and remains visually stable.

## AI Activity Guard Note
- Implemented.
- Guard source at AppShell level: `graphRuntimeStatus.isLoading`.
- This value is fed by graph runtime status callbacks and maps to runtime AI activity.
- When active, B2 fade/switch is blocked with `[B2Fade] blocked: aiActivity`.

## Verification
- Build:
  - `npm run build` passed.

- Repro checklist:
  1. A unchanged:
     - prompt submit -> `graph_loading` + confirm.
  2. B1 unchanged:
     - prompt select saved -> 200ms fade -> direct graph.
  3. B1-reverse unchanged:
     - graph create new -> 200ms fade -> prompt.
  4. B2 new:
     - graph select other saved -> 200ms fade -> graph switches.
  5. Sidebar stability:
     - no fade/freeze/collapse/move during any nav fade.
