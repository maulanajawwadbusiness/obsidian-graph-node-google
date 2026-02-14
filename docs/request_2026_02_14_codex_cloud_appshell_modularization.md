# Codex Cloud Task Request: AppShell Modularization + Onboarding Transition Seam Hardening

## Context
We have recently implemented premium 200ms onboarding transitions and fixed prompt-overlay flicker in:
- `src/screens/AppShell.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/auth/LoginOverlay.tsx`

Related reports:
- `docs/report_2026_02_14_onboarding_fade_transition.md`
- `docs/report_2026_02_14_welcome2_prompt_overlay_fade.md`
- `docs/report_2026_02_14_prompt_overlay_flicker_rootcause_fix.md`

Current problem: `AppShell.tsx` is too large and too cross-coupled. It is currently about 2352 lines and mixes many concerns, making future changes high-risk and mentally expensive.

## Core Goal
Refactor `AppShell` into a modular concern-based structure so the final `src/screens/AppShell.tsx` is under 450 lines, while preserving behavior.

This includes making onboarding transition seam management straightforward and explicit, so future agents can modify flow logic without re-discovering hidden coupling.

## Why this matters
`AppShell` currently owns too much at once:
- screen routing and onboarding flow
- transition state machine and rendering topology
- prompt/login overlay coordination
- fullscreen onboarding chrome behavior
- sidebar and modal orchestration
- saved interface sync/write brain

This concentration increases regression risk in:
- input shielding
- overlay ownership
- onboarding flow transitions
- saved interface ordering and restore purity

## Non-negotiable outcomes
1. `src/screens/AppShell.tsx` must be under 450 lines.
2. Behavior parity must hold for existing UX and contracts.
3. Onboarding transition seam must be easy to understand and clearly documented.
4. No secret or auth policy regressions.
5. No pointer event leakage regressions.

## Critical contracts to preserve

### Onboarding and Transition
- Existing flow contract: `welcome1 -> welcome2 -> prompt -> graph`.
- `ONBOARDING_ENABLED` and `VITE_ONBOARDING_START_SCREEN` behavior must remain unchanged.
- 200ms premium fade behavior must remain intact for onboarding transitions.
- Prompt transition should not reintroduce flicker or remount pulse.
- Reduced-motion handling must still work.

### Overlay and Input Ownership
- Panels/overlays must own input inside bounds.
- No pointer or wheel leakage to underlying canvas when overlays are active.
- `FullscreenButton` blocking behavior must remain correct when onboarding overlays are open.

### Saved Interfaces and Sync Brain
- Preserve AppShell single-writer contract for saved interfaces.
- Preserve restore-read-only guarantees.
- Preserve ordering contract and rename non-reorder behavior.
- Preserve outbox retry semantics and identity isolation behavior.

### Auth Safety
- Keep `/me` as auth truth source.
- Do not add token localStorage/sessionStorage behavior.
- Keep credentials-included fetch expectations intact.

## Expected architecture direction
Use medium-to-strong seam extraction, but keep behavior stable.

### Target module split (suggested)
You may adjust names slightly, but preserve this concern boundary:

1. `src/screens/appshell/screenFlow/`
- `screenTypes.ts` (Screen type, helpers)
- `screenStart.ts` (initial screen + env parsing bridge if needed)
- `screenFlowController.ts` (transition triggers and flow policy)

2. `src/screens/appshell/transitions/`
- `transitionTokens.ts` (single source for fade timing/easing)
- `useOnboardingTransition.ts` (state machine: from, ready, epoch, timers)
- `OnboardingLayerHost.tsx` (stable active layer + from layer + shield)

3. `src/screens/appshell/overlays/`
- `useOnboardingOverlayState.ts` (welcome1/prompt overlay coordination)
- `OnboardingChrome.tsx` (fullscreen button logic)
- existing modals can remain where they are initially, but extract if needed to hit line budget

4. `src/screens/appshell/savedInterfaces/`
- `useSavedInterfacesSync.ts` (remote outbox + hydrate + mirror)
- `savedInterfacesCommits.ts` (commit surfaces: upsert/rename/delete/layout patch/hydrate)
- keep current behavioral contracts unchanged

5. `src/screens/appshell/render/`
- `renderScreenContent.tsx` or equivalent mapper
- separate pure rendering helpers from orchestration state

## Line budget target
- `src/screens/AppShell.tsx`: under 450 lines.
- Keep modules reasonably sized and single-purpose.

## Implementation constraints
- ASCII only in code/comments/docs.
- Minimal diffs where possible, but modularization can be broad if concern seams are clean.
- Do not use browser testing tools.
- Avoid introducing third-party dependencies.
- Keep TypeScript strictness and existing build path healthy.

## Mandatory documentation deliverables
1. Add a main refactor report in `docs/` with:
- before/after architecture map
- file movement table
- preserved contracts checklist
- known residual risks

2. Update `docs/system.md` sections that describe onboarding/AppShell truth if any path or ownership changes.

3. Add short seam guide for future agents, for example:
- where to change transition timing
- where to change flow order
- where to change overlay ownership
- where not to touch saved-interface write logic

## Verification checklist (must run)
1. Build:
- `npm run build`

2. Manual flow verification checklist (log in report):
- welcome1 -> welcome2 fade works
- welcome2 -> prompt fade works
- no prompt/login overlay flicker
- prompt -> graph path still works
- graph -> prompt (create new) still works
- fullscreen button block/unblock correctness
- sidebar disabled behavior when login overlay open

3. Saved interfaces sanity:
- rename does not reorder
- restore remains read-only
- delete clears pending selection if needed

## Regression guardrails
- Do not regress hook order safety in AppShell.
- Do not regress pointer shielding rules.
- Do not regress onboarding wheel guard behavior.
- Do not regress login overlay fade and reduced-motion behavior.

## Suggested execution order
1. Extract transition tokens + hook + layer host first.
2. Extract screen rendering mapper.
3. Extract overlay coordination state.
4. Extract saved-interface sync/commit seams.
5. Slim AppShell to orchestration wiring under 450 lines.
6. Run verification and docs update.

## Definition of done
- `AppShell.tsx` under 450 lines.
- Build passes.
- Transition and overlay behavior parity preserved.
- Required docs updated.
- Refactor report added in `docs/` with concrete evidence and verification notes.

## Notes for agent
- Preserve existing user-facing behavior unless explicitly required by contract.
- Favor explicit interfaces between seams over implicit shared state.
- If any unavoidable tradeoff appears, document it clearly in the refactor report with rationale.
