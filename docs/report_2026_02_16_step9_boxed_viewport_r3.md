# Step 9 Boxed Viewport Run 3 - Hardening, Invariants, Docs

Date: 2026-02-16
Run: r3
Scope: add boxed-path diagnostics and warn guards, then update system docs.

## Hardening added

1. Dev counters in viewport math
- file: `src/runtime/viewport/viewportMath.ts`
- counters:
  - `boxedClampCalls`
  - `boxedPointerNormCalls`
  - `boxedTooltipClampCalls`
- exposed via:
  - `getBoxedViewportDebugCounters()`

2. Warn-once guard for boxed mode missing bounds
- file: `src/runtime/viewport/viewportMath.ts`
- if `viewport.mode==='boxed'` and `boundsRect` missing:
  - warn once and fall back to origin `(0,0)`

3. Boxed callsite instrumentation
- `TooltipProvider` marks boxed tooltip clamp activity.
- `NodePopup`, `MiniChatbar`, `ChatShortageNotif` mark boxed clamp activity.
- `toViewportLocalPoint` marks boxed pointer normalization calls.

## Docs updated

Updated `docs/system.md` with section:
- `2.11 Boxed Viewport Consumption (Step 9, 2026-02-16)`

Added:
- changed subsystem list
- boxed vs app behavior rule
- dev invariant counters and warn-once fallback note
- manual verification checklist for preview containment and app-mode parity

## Notes

- Camera containment and pointer->world core transform remained unchanged (already rect-based).
- Step 9 changes remain focused on boxed screen-space clamp/origin consumption.
