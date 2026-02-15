# Report 2026-02-15: Transition Control Hardening

## 1. Scope
Harden onboarding transition control so behavior is explicit, centralized, and easier to maintain without hidden coupling.

Target flow:
- `welcome1 -> welcome2`
- `welcome2 -> prompt`
- `prompt -> welcome2`
- transitions touching `graph` remain non-animated

## 2. Problems Addressed
1. Transition timing and easing were duplicated across seams.
2. Transition lifecycle was represented by implicit booleans instead of explicit phase states.
3. Route animation rules were inferred by broad onboarding checks instead of explicit pair policy.
4. Overlay authority was only partially enforced by screen.

## 3. Implementation

### 3.1 Canonical transition contract
Added:
- `src/screens/appshell/transitions/transitionContract.ts`

Contract now owns:
- `ONBOARDING_FADE_MS`
- `ONBOARDING_FADE_EASING`
- `TransitionPhase` (`idle | arming | fading`)
- `getTransitionPolicy(from, to)`
- `isOverlayFadeEnabledForScreen(screen)`

Animated route matrix is explicit in policy:
- `welcome1 <-> welcome2`
- `welcome2 <-> prompt`

All graph-boundary transitions are explicit non-animated policy decisions.

### 3.2 Phase-based transition machine
Updated:
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

Behavior:
- explicit phase state (`idle`, `arming`, `fading`)
- retained epoch guard against stale timer and RAF callbacks
- reduced-motion keeps parity by resolving transition without animated fade
- DEV observability logs added:
  - route policy decision
  - phase transitions

### 3.3 Layer host clarity
Updated:
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`

Changes:
- props renamed for intent (`fromScreen`, `isFadeArmed`, `isCrossfading`, `fadeMs`)
- opacity state derived via helper (`getLayerOpacityState`)
- transition shield remains active only during crossfade

### 3.4 Overlay authority hardening
Updated:
- `src/screens/appshell/overlays/useOnboardingOverlayState.ts`

Rules:
- welcome1 overlay is force-closed outside `welcome1`
- prompt overlay is force-closed outside `prompt`
- returned open-state values are screen-authority scoped
- DEV logs added when force-close happens

### 3.5 AppShell and LoginOverlay wiring
Updated:
- `src/screens/AppShell.tsx`
  - consumes new transition API
  - uses canonical easing from transition contract
- `src/auth/LoginOverlay.tsx`
  - uses canonical fade timing and easing from transition contract
  - no duplicate fade constants
- `src/screens/appshell/transitions/transitionTokens.ts`
  - now re-exports from transition contract for compatibility

## 4. Documentation Sync
Updated:
- `docs/system.md`
  - onboarding transition seams now include transition contract and explicit route matrix
  - EnterPrompt login overlay truth updated (`LOGIN_OVERLAY_ENABLED = true`)
  - AppShell line count updated to 432
- `docs/repo_xray.md`
  - AppShell line count updated to 432
  - transition contract seam added
  - transition seam description updated to contract + phase machine

## 5. Verification
Build verification:
- `npm run build`

Manual verification checklist (required):
1. `welcome1 -> welcome2` fade still 200ms and smooth.
2. `welcome2 -> prompt` fade still 200ms and smooth with login overlay sync.
3. logged-out `welcome2 -> prompt` does not flicker.
4. `prompt -> welcome2` resets prompt overlay authority correctly.
5. `prompt -> graph` remains non-animated by policy.
6. pointer and wheel are blocked only during transition window.

## 6. Safety Notes
1. No third-party dependencies added.
2. No backend or schema changes.
3. No topology, physics, auth-cookie, or saved-interface write-path behavior changed.
