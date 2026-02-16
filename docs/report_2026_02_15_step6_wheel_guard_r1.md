# Step 6 Wheel Guard Conflict Report (Run 1)

Date: 2026-02-15
Scope: forensic only, no behavior changes

## Wheel Guard Owner and Blocking Mechanism

Primary hook:
- `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`

Current behavior:
- Attaches listener on `window` with `capture: true` and `passive: false`.
  - `window.addEventListener('wheel', onWheel, { passive: false, capture: true });`
- Handler currently calls `event.preventDefault()` unconditionally.
- No target allowlist check exists yet.
- No `stopPropagation` or `stopImmediatePropagation` is used.

Why preview is blocked:
- Guard runs in capture phase at `window` and always prevents default before graph runtime wheel handler can own the event path.
- Result: wheel input over preview does not reach intended runtime behavior consistently.

## Enablement Path

Callsite:
- `src/screens/AppShell.tsx`

Wiring:
- `useOnboardingWheelGuard({ enabled: ONBOARDING_ENABLED, active: onboardingActive, debug: DEBUG_ONBOARDING_SCROLL_GUARD })`
- `onboardingActive = isOnboardingScreen(screen) || isBlockingInput`

Implication:
- Guard is active on onboarding flow and can remain active during EnterPrompt states where preview exists.

## Preview Root and Portal Markers

Preview seam helper file:
- `src/components/sampleGraphPreviewSeams.ts`

Current root marker:
- `data-arnvoid-graph-preview-root="1"`
- helper: `isInsideSampleGraphPreviewRoot(target)`

Portal root marker in preview component:
- `src/components/SampleGraphPreview.tsx`
- root element has `data-arnvoid-preview-portal-root="1"`

## Proposed Gating Rule (Allowlist Only)

Rule:
- if wheel event target is inside preview root OR preview portal root, onboarding guard returns early (no preventDefault).
- for all other targets, onboarding guard behavior remains identical (preventDefault as today).

This preserves onboarding anti-scroll discipline while unblocking real preview graph wheel handling.
