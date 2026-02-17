# Report: B1 Reverse Nav Fade Run1 (2026-02-17)

## Scope
- Implement B1-reverse only:
  - `graph -> sidebar create new -> prompt` uses the same content-only 200ms fade as B1 forward.
- Keep analysis and gate behavior unchanged.

## Files Changed
- `src/screens/AppShell.tsx`
- `docs/report_2026_02_17_b1_reverse_nav_fade_run1.md`

## Key Logic
- Generalized fade intent in `AppShell`:
  - added `PendingFadeAction` union:
    - `{ kind: 'restoreInterface'; record }`
    - `{ kind: 'createNew' }`
  - replaced previous restore-only ref with `pendingFadeActionRef`.

- Forward B1 path preserved with fade-idle guard:
  - in `selectSavedInterfaceById`, when on `prompt`:
    - ignores trigger if `contentFadePhase !== 'idle'`
    - sets fade action `restoreInterface`
    - starts fade out
    - logs `[B1Fade] start ...`

- New B1-reverse path:
  - in sidebar `onCreateNew` handler:
    - ignores trigger if fade is active
    - if current screen is graph-class:
      - sets fade action `createNew`
      - starts fade out
      - logs `[B1ReverseFade] start ...`
    - otherwise keeps existing direct behavior.

- Fade out completion generalized:
  - reads and clears `pendingFadeActionRef`
  - `restoreInterface`:
    - sets `pendingLoadInterface`
    - direct `transitionToScreen('graph')`
    - logs `[B1Fade] commit ...`
  - `createNew`:
    - clears `pendingLoadInterface`
    - clears `pendingAnalysis`
    - direct `transitionToScreen('prompt')`
    - logs `[B1ReverseFade] commit`
  - then starts fade in.

- Fade in completion:
  - sets phase back to idle
  - logs `[NavFade] done`

- Existing dev invariant warning was kept:
  - restore should not route to `graph_loading`.

## Sidebar Layer Proof
- `ContentFadeOverlay` remains content-only and mounted in non-sidebar layer.
- `ContentFadeOverlay` z-index: `40`.
- Sidebar layer z-index (`LAYER_SIDEBAR`): `50` in `src/ui/layers.ts`.
- Result: sidebar remains a stability anchor and is not faded/dimmed/moved by nav fade.

## Verification
- Build command:
  - `npm run build` passed.

- Repro checklist:
  1. A unchanged:
     - prompt submit -> `graph_loading` + confirm -> graph.
  2. B1 unchanged:
     - prompt -> select saved graph from sidebar/search -> 200ms fade -> graph (no gate).
  3. B1-reverse:
     - graph -> sidebar create new -> 200ms fade -> prompt (no gate).
  4. Sidebar stability:
     - confirm sidebar does not fade, freeze, collapse, or shift during fades.
