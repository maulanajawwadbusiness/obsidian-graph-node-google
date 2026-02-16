# Step 6 Wheel Guard Hardening Report (Run 3)

Date: 2026-02-15
Focus: non-element target safety and dev counters

## Changed File
- `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`

## Hardening Applied

1. Non-element target normalization
- Added `toElement(target)` utility in hook effect.
- Handles:
  - `Element` targets directly
  - `Node` targets via `parentElement`
  - unknown targets as `null`
- Preview allowlist checks now run against normalized element.

2. Portal allowlist check now uses normalized element
- `isInsidePreviewPortalRoot(...)` now resolves from normalized element.

3. DEV-only counters added (minimal)
- `allowedPreviewWheelCount`
- `blockedWheelCount`
- Stored in `debugCountersRef` for stable accumulation.
- Aggregated logging only every 50 events when `debug` is enabled.
- No per-event spam introduced.

## Safety Defaults
- If target cannot be normalized to element, allowlist does not match and guard falls back to existing block behavior.
