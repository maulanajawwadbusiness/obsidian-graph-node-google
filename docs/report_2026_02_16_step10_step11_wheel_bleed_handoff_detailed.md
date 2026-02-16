# Sharp Handoff Report: Step 10 + Step 11 Boxed Preview Hardening

Date: 2026-02-16
Branch: `wire-preview-mount-graph`
Audience: next code agent resuming boxed preview runtime hardening

## 1. Executive Summary

Completed work in this block:
1. Step 10 boxed input ownership baseline (runs r1-r5).
2. Step 11 boxed-only UI rules (runs r1-r5).
3. Step 10 must-fix wheel bleed patch (runs r1-r8, latest and most critical).

Primary outcome:
- Wheel events starting inside preview are now scrollability-gated and no longer marker-gated.
- Non-scrollable overlay wheel zones are forced `preventDefault`, so page scroll fallback is blocked.
- Scrollable overlay zones are allowed to scroll locally.
- Runtime overlay/fullscreen escape surfaces in boxed mode are disabled/contained with boxed policy guardrails.

## 2. Commit Timeline (relevant)

Step 10 baseline:
1. `d1aa9f7` docs(step10): map boxed input ownership + bleed points (r1)
2. `61101bf` fix(step10): capture wheel inside preview to prevent page scroll bleed (r2)
3. `284d02d` fix(step10): overlay roots capture pointer/wheel to prevent canvas-underlay reactions (r3)
4. `fb0b5f7` chore(step10): harden portal/overlay pointer-events + overscroll/touch-action for boxed preview (r4)
5. `a18fa53` docs(step10): document boxed input ownership contract + dev counters (r5)

Step 11 boxed UI rules:
1. `b3e41d3` docs(step11): inventory fullscreen-ish runtime surfaces + boxed rule plan (r1)
2. `22c9295` feat(ui): add boxed UI policy helper + dev warn-once for body portals (r2)
3. `5f87352` fix(boxed-ui): contain/disable high-risk fullscreen overlays in preview (r3)
4. `ef66b28` fix(boxed-ui): apply boxed containment rules across remaining runtime surfaces + guardrails (r4)
5. `5d17e8c` docs(step11): boxed UI rules contract + dev counters (r5)

Step 10 wheel bleed must-fix (latest):
1. `8dfb48a` fix(step10): gate overlay wheel pass-through by scrollability to prevent page scroll bleed (r1-r2)
2. `8bd5c55` fix(step10): add overscroll containment + overlay-level wheel safety gates (r3-r4)
3. `b09ad83` chore(step10): add dev counters + warn-once rails for boxed wheel bleed regressions (r5-r6)
4. `6460775` docs(step10): document scrollability-gated wheel policy + final audit (r7-r8)

## 3. Final Runtime Contract (current truth)

## 3.1 Step 10 wheel contract

1. Preview wheel capture in `src/components/SampleGraphPreview.tsx` now uses scrollability-gated policy.
2. Wheel started inside preview must not cause page scroll.
3. Overlay wheel default is allowed only if local overlay scroll consumer can consume delta.
4. Overlay non-scrollable zones force `preventDefault`.
5. Overlay roots also enforce defense-in-depth wheel capture logic.

## 3.2 Step 11 boxed UI contract

1. Boxed runtime fullscreen-like UI branches are disabled where unsafe.
2. Boxed portal targets are guarded against `document.body` fallback.
3. If safe boxed portal root cannot be resolved, affected surface disables safely.
4. App mode behavior remains unchanged.

## 4. Key Files Changed

Wheel bleed and overlay gating:
1. `src/components/SampleGraphPreview.tsx`
2. `src/components/sampleGraphPreviewSeams.ts`
3. `src/popup/NodePopup.tsx`
4. `src/popup/MiniChatbar.tsx`
5. `src/popup/ChatShortageNotif.tsx`

Boxed UI policy and portal guardrails:
1. `src/runtime/ui/boxedUiPolicy.ts`
2. `src/popup/PopupOverlayContainer.tsx`
3. `src/ui/tooltip/TooltipProvider.tsx`
4. `src/playground/components/AIActivityGlyph.tsx`
5. `src/playground/components/CanvasOverlays.tsx`
6. `src/playground/GraphPhysicsPlaygroundShell.tsx`

Docs:
1. `docs/system.md`
2. `docs/report_2026_02_16_step10_boxed_input_r1.md` ... `r5.md`
3. `docs/report_2026_02_16_step11_boxed_ui_rules_r1.md` ... `r5.md`
4. `docs/report_2026_02_16_step10_wheel_bleed_fix_r1.md` ... `r8.md`

## 5. New/Updated Seams and Helpers

File: `src/components/sampleGraphPreviewSeams.ts`

Important exports:
1. Existing:
- preview root/portal selectors
- overlay interactive selector

2. Added for wheel bleed fix:
- `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_ATTR`
- `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_VALUE`
- `SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_SELECTOR`
- `findClosestOverlayInteractiveRoot(...)`
- `findScrollableWheelConsumer(...)`
- `shouldAllowOverlayWheelDefault(...)`

Perf hardening in helper:
1. zero-delta short-circuit
2. ancestor walk bounded to overlay root
3. explicit scroll marker fast path
4. overflow capability `WeakMap` cache to reduce repeated style reads

## 6. Overlay Marker Usage (current)

Interactive root marker (`data-arnvoid-overlay-interactive="1"`):
1. `NodePopup` root
2. `MiniChatbar` root
3. `ChatShortageNotif` root

Explicit scrollable marker (`data-arnvoid-overlay-scrollable="1"`):
1. `NodePopup` content scroller
2. `MiniChatbar` messages scroller

Non-interactive surfaces (intentionally unmarked):
1. Tooltip layer and bubble (`pointerEvents: none`)
2. Popup overlay wrapper (`pointerEvents: none`)

## 7. Dev Rails (current)

SampleGraphPreview counters (dev-only):
1. `previewWheelPreventedNonOverlay`
2. `previewWheelAllowedScrollableOverlay`
3. `previewWheelPreventedNonScrollableOverlay`
4. `previewPointerStopPropagationCount`

Onboarding wheel guard warn-once:
1. warns if preview-origin wheel unexpectedly enters blocked path
2. file: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`

Boxed UI policy counters (dev-only):
1. `boxedBodyPortalAttempts`
2. `boxedSurfaceDisabledCount`

## 8. Verification Performed

Build status:
1. `npm run build` executed in every run across Step 10 baseline, Step 11, and Step 10 must-fix runs.
2. One transient TypeScript inference error during wheel-fix run 2 was fixed immediately (`sampleGraphPreviewSeams.ts` local type annotation).
3. Final state builds pass.

## 9. Known Caveats / Follow-up Risk

1. `useOnboardingWheelGuard` (window capture) can still observe preview wheel events due listener order; contract is that it must not block preview wheel path.
2. Manual interaction verification in browser is still required for absolute confidence (canvas zoom, overlay scroll, non-scroll zones).
3. Tooltip remains non-interactive by design; wheel handling there is not a scroll consumer path.

## 10. Resume Instructions (sharp)

If continuing from here, start with:
1. `docs/report_2026_02_16_step10_wheel_bleed_fix_r8.md`
2. `src/components/SampleGraphPreview.tsx`
3. `src/components/sampleGraphPreviewSeams.ts`
4. `src/popup/NodePopup.tsx`
5. `src/popup/MiniChatbar.tsx`
6. `src/popup/ChatShortageNotif.tsx`
7. `docs/system.md` (Step 10 and Step 11 sections)

Then run this manual checklist:
1. wheel on preview canvas zooms/pans and page does not scroll
2. wheel on MiniChat messages scrolls list only
3. wheel on popup headers/non-scrollable surfaces does not scroll page
4. wheel outside preview still follows onboarding guard
5. repeated mount/unmount does not duplicate wheel listener behavior

## 11. Current Worktree Context (important)

There are unrelated modified/untracked files in the tree right now (outside this workstream). Do not revert them unless explicitly requested.

At report time, unrelated changes include files such as:
1. `docs/repo_xray.md`
2. `package.json`
3. `src/auth/LoginOverlay.tsx`
4. `src/components/Sidebar.tsx`
5. `src/screens/AppShell.tsx`
6. plus additional docs/scripts/style files shown by `git status`

This Step 10/11 report is scoped to the commits listed above.