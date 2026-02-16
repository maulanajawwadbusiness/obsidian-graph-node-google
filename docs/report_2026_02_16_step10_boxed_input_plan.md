# Step 10 Plan: Boxed Input Ownership (Pointer + Wheel + Overlays)

Date: 2026-02-16
Branch baseline: `wire-preview-mount-graph`
Scope: Step 10 only

## 1) Goal
When EnterPrompt preview runtime is mounted (boxed embed):
1. Pointer + wheel input inside preview is owned by preview runtime and boxed overlays.
2. Underlying onboarding/page does not react (no scroll bleed, no click-through).
3. Canvas does not react when interacting with boxed overlays.
4. Graph screen app mode behavior remains unchanged.

## 2) Current-State Forensics (Must Respect)

1. Onboarding wheel guard (`useOnboardingWheelGuard`) already allowlists preview root + preview portal root and blocks other onboarding wheel targets.
2. Preview portal root is inside preview root and currently uses `pointerEvents: 'none'`.
3. Tooltip layer/bubble are non-interactive (`pointerEvents: 'none'`), so tooltip should not be treated as interactive overlay input owner.
4. Node popup / mini chat / shortage notif already stop some propagation, but capture-phase ownership is not fully standardized.
5. Preview root has no dedicated capture wheel ownership guard with `passive:false`; page scroll suppression currently depends on downstream behavior.

## 3) Constraints

1. No visual changes.
2. No physics/camera behavior changes.
3. No Step 11+ features.
4. Minimal diffs, no permanent loops.
5. Keep app mode unaffected.

## 4) Acceptance Criteria

1. Wheel inside preview: graph zoom/pan works, page does not scroll.
2. Wheel outside preview: onboarding wheel guard behavior unchanged.
3. Drag/point inside preview: preview graph handles input; onboarding does not react.
4. Overlay interaction: overlay owns pointer/wheel; canvas does not react beneath.
5. No click-through to behind-preview elements.

## 5) Run Plan (5 Runs, Commit Every Run)

## Run 1 - Forensic ownership map and bleed points (docs only)
Tasks:
1. Enumerate handler chain:
   - onboarding guard
   - preview root + portal root
   - boxed overlays (`TooltipProvider`, `NodePopup`, `MiniChatbar`, `ChatShortageNotif`)
2. List concrete bleed points with file/line references.
3. Lock minimal fix strategy.
4. Run `npm run build` and note if blocked by unrelated error.

Deliverable:
- `docs/report_2026_02_16_step10_boxed_input_r1.md`

Commit:
- `docs(step10): map boxed input ownership + bleed points (r1)`

## Run 2 - Preview wheel capture ownership (page scroll bleed stop)
Tasks:
1. Add preview-root wheel capture listener (`passive:false`) in `SampleGraphPreview`.
2. Default behavior inside preview:
   - `preventDefault()` + `stopPropagation()`
3. Add strict cleanup and dev tracker lifecycle for this listener.
4. Keep graph screen app mode untouched.

Deliverable:
- `docs/report_2026_02_16_step10_boxed_input_r2.md`

Commit:
- `fix(step10): capture wheel inside preview to prevent page scroll bleed (r2)`

## Run 3 - Overlay interactive ownership (pointer/wheel capture)
Tasks:
1. Add a small helper/convention for interactive boxed overlays:
   - `data-arnvoid-overlay-interactive="1"`
2. Mark interactive overlay roots:
   - `NodePopup`
   - `MiniChatbar`
   - `ChatShortageNotif`
3. Add capture-phase stopPropagation to interactive roots:
   - `onPointerDownCapture`
   - `onWheelCapture`
4. Keep tooltip non-interactive (no marker).

Deliverable:
- `docs/report_2026_02_16_step10_boxed_input_r3.md`

Commit:
- `fix(step10): overlay roots capture pointer/wheel to prevent canvas-underlay reactions (r3)`

## Run 4 - Portal containment and click-through hardening
Tasks:
1. Preserve portal model:
   - portal root `pointerEvents: 'none'`
   - interactive children `pointerEvents: 'auto'`
2. Add preview root guardrails:
   - `overscrollBehavior: 'contain'`
   - `touchAction: 'none'` (preview-only)
   - `onPointerDownCapture` stopPropagation on preview root
3. Ensure no preview overlay escapes to app-level input ownership.

Deliverable:
- `docs/report_2026_02_16_step10_boxed_input_r4.md`

Commit:
- `chore(step10): harden portal/overlay pointer-events + overscroll/touch-action for boxed preview (r4)`

## Run 5 - Dev rails and docs contract
Tasks:
1. Add dev-only counters (non-spam):
   - `previewWheelPreventedCount`
   - `previewWheelOverlayPassThroughCount`
   - `previewPointerStopPropagationCount`
2. Add warn-once if onboarding guard blocks wheel with target inside preview roots (should never happen).
3. Update `docs/system.md` Step 10 ownership contract and overlay marker convention.
4. Final acceptance checklist mapping.

Deliverable:
- `docs/report_2026_02_16_step10_boxed_input_r5.md`

Commit:
- `docs(step10): document boxed input ownership contract + dev counters (r5)`

## 6) Implementation Notes (Decision Complete)

1. Tooltip remains non-interactive; do not convert it into overlay input owner.
2. Overlay-native scrolling is allowed only for marked interactive overlays; onboarding/canvas leakage must still be blocked via propagation stop.
3. Any new boxed overlay added later must:
   - set `data-arnvoid-overlay-interactive="1"`
   - set `pointerEvents: 'auto'`
   - stop pointer/wheel in capture phase.

