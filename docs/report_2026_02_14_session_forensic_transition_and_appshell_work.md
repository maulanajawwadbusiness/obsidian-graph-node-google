# Report 2026-02-14: Forensic Session Log (Onboarding Fade, Overlay Sync, Flicker, and AppShell Readiness)

## 1. Executive Summary
This session focused on onboarding transition quality and reliability, especially around:
- `welcome1 -> welcome2` fade quality,
- `welcome2 -> prompt` fade + login overlay sync,
- React hook-order crash in `AppShell`,
- prompt overlay flicker caused by transition boundary remount churn,
- maintainability handoff for deep AppShell modularization.

A sequence of forensic traces and targeted fixes was performed, with build verification after each major change. A Codex Cloud refactor request document was also authored for large-scale modularization.

## 2. Initial Problem Space and Intent
User intent evolved in phases:
1. Understand onboarding transition wiring (`welcome1 -> welcome2 -> prompt -> graph`) with forensic precision.
2. Implement a premium 200ms fade transition for onboarding progression.
3. Investigate and fix runtime errors and visual regressions introduced by transition changes.
4. Prepare maintainability/handoff materials for broader AppShell modularization.

## 3. Phase-by-Phase Forensic Timeline

### Phase A: Startup Flow Forensics (Read-Only Investigation)
Read and traced:
- `docs/system.md`
- `docs/repo_xray.md`
- `src/screens/AppShell.tsx`
- `src/screens/Welcome1.tsx`
- `src/screens/Welcome2.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/auth/LoginOverlay.tsx`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`

Findings:
- State machine owner: `AppShell` screen state (`welcome1|welcome2|prompt|graph`).
- Transition calls are wired from screen callbacks into `setScreen(...)` flow.
- Prompt payload handoff (`pendingAnalysis`) is consumed in graph shell after graph mount conditions.
- Overlay/input ownership depends on explicit shielding and overlay-open flags.

### Phase B: 200ms Onboarding Fade Implementation
Implemented in `src/screens/AppShell.tsx` (pre-modularization shape at the time):
- Added 200ms transition constants and easing.
- Added transition state (`screenTransitionFrom`, `screenTransitionReady`) and control refs.
- Added reduced-motion handling with `matchMedia`.
- Added `transitionToScreen(...)` helper to animate only onboarding-to-onboarding transitions.
- Added dual-layer crossfade render path and input shield during transition.
- Kept graph transitions non-animated per scope decision.

Verification:
- `npm run build` passed after one ordering fix.

Report added:
- `docs/report_2026_02_14_onboarding_fade_transition.md`

### Phase C: Lint and Dev Checks
Commands run:
- `npm run lint` -> failed (no lint script defined)
- `npm run` -> scripts found: `dev`, `build`, `preview`
- `npx eslint .` -> failed (no ESLint config)
- `npm run dev` -> failed on port 5173 already in use

Outcome:
- Repo had no configured lint pipeline at that point.
- Dev-server check uncovered environment port contention, not app logic failure.

### Phase D: React Hook-Order Runtime Crash
Observed error (user screenshot):
- `Rendered more hooks than during the previous render` in `AppShell`.

Root cause traced:
- A conditional early return in `AppShell` (welcome1 font gate) executed before a later `useCallback` declaration.
- Some renders returned before that hook; later renders reached it, violating hook-order invariants.

Fix applied:
- Converted `renderScreenContent` from `React.useCallback(...)` to a plain local function (non-hook).

Verification:
- `npm run build` passed.

### Phase E: Future Hardening TODO
Added explicit future item for hook-order hardening:
- `docs/FUTURE_TODO.md`

### Phase F: Overlay Sync for `welcome2 -> prompt`
Forensic finding:
- The onboarding fade existed, but prompt login overlay (portal at high z-index) visually masked transition continuity.

Fix applied in `src/auth/LoginOverlay.tsx`:
- Added opacity fade-in (`200ms`, same premium easing intent).
- Added reduced-motion support.
- Preserved immediate input shielding and scroll lock behavior.

Verification:
- `npm run build` passed.

Report added:
- `docs/report_2026_02_14_welcome2_prompt_overlay_fade.md`

### Phase G: Prompt/Overlay Flicker Forensics and Fix
Symptom:
- Prompt and overlay appeared to switch back and forth during/after fade.

Root cause:
1. Transition boundary remount churn in `AppShell` (transition host to non-transition branch handoff).
2. `EnterPrompt` unmount cleanup emitted `onOverlayOpenChange(false)`, followed by mount-time `true`.
3. Portal `LoginOverlay` tore down/recreated, causing visible flicker.
4. DEV `React.StrictMode` made churn more obvious but was not the root cause.

Fixes applied:
- `src/screens/AppShell.tsx`
  - stable onboarding layer host path retained active layer continuity,
  - explicit `enterPromptOverlayOpen` reset when leaving prompt.
- `src/screens/EnterPrompt.tsx`
  - removed unmount cleanup pulse that forced overlay false on unmount.

Verification:
- `npm run build` passed.

Report added:
- `docs/report_2026_02_14_prompt_overlay_flicker_rootcause_fix.md`

## 4. Commit and Staging Actions Recorded
User requested: stage all untracked and commit.

Action performed:
- staged untracked report file and committed only that untracked batch.

Commit created:
- `da85d0c`
- message: `docs(report): add prompt overlay flicker root-cause fix`

Note at that point:
- tracked code changes remained unstaged/uncommitted in that specific commit step.

## 5. Codex Cloud Handoff Preparation
A detailed Codex Cloud implementation request was authored for deep AppShell modularization:
- `docs/request_2026_02_14_codex_cloud_appshell_modularization.md`

The request included:
- issue context,
- architectural target (`AppShell < 450 lines`),
- seam boundaries,
- invariants and contracts,
- verification and deliverables,
- definition of done.

## 6. Freshness Check After User-Reported Modularization
User later stated modularization was completed.

Verification performed against current repository state:
- `src/screens/AppShell.tsx` line count now `447`.
- seam files under `src/screens/appshell/*` exist and are imported from AppShell.
- `AGENTS.md` AppShell architecture section aligns with current seam map.
- `docs/repo_xray.md` reflects modularization and backend seam updates.

One drift found:
- `docs/system.md` still states EnterPrompt login overlay is off (`LOGIN_OVERLAY_ENABLED = false`),
- code currently has `LOGIN_OVERLAY_ENABLED = true` in `src/screens/EnterPrompt.tsx`.

## 7. Net Technical Outcomes
1. Onboarding 200ms fade behavior established and hardened.
2. Hook-order runtime crash in AppShell resolved.
3. Prompt overlay fade-in synchronized for better visual continuity.
4. Prompt overlay flicker root cause eliminated via remount-boundary fix.
5. Future hardening TODO captured.
6. Codex Cloud modularization request package authored.
7. Post-modularization docs/code freshness validated with one identified documentation mismatch.

## 8. Open Items and Recommended Next Steps
1. Update `docs/system.md` login overlay line to match current code truth (`LOGIN_OVERLAY_ENABLED = true`) or gate behavior if intentionally changed.
2. Keep transition timing tokens centralized and avoid duplicate literals.
3. Preserve overlay pointer/wheel shielding invariants on any future onboarding/ui refactor.
4. When touching auth/session/CORS behavior, update `docs/report_2026_02_05_auth_session_postgres.md` per doctrine.

## 9. Commands and Verification Summary
Commands used during this session included:
- read/search (`Get-Content`, `rg`) across docs and onboarding files,
- build verification (`npm run build`) repeatedly after major fixes,
- lint/dev probing (`npm run lint`, `npm run`, `npx eslint .`, `npm run dev`),
- git status/diff/commit checks.

Build status at all major fix checkpoints:
- PASS (`tsc && vite build`).

## 10. Files Materially Involved During Session
Primary code files:
- `src/screens/AppShell.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/auth/LoginOverlay.tsx`

Session documentation files created/updated:
- `docs/report_2026_02_14_onboarding_fade_transition.md`
- `docs/report_2026_02_14_welcome2_prompt_overlay_fade.md`
- `docs/report_2026_02_14_prompt_overlay_flicker_rootcause_fix.md`
- `docs/request_2026_02_14_codex_cloud_appshell_modularization.md`
- `docs/FUTURE_TODO.md` (hook-order hardening entry)

## 11. Final Forensic Verdict
Session goals were met at each operational stage:
- transition behavior implemented,
- runtime crash diagnosed and fixed,
- visual flicker root cause traced and corrected,
- maintainability handoff documented,
- current architecture freshness validated.

Current state is operationally stable for continuation, with one explicit docs drift (`docs/system.md` login overlay flag) to resolve.
