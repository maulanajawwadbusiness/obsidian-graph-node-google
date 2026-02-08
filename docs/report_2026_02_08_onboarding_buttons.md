# Onboarding Button Location Report

**Date**: 2026-02-08
**Scope**: "Back", "Skip", and "Hide" buttons across onboarding screens

## Executive Summary

This report identifies all occurrences of "Back", "Skip", and "Hide" buttons in the onboarding screen flow (Welcome1 -> Welcome2 -> EnterPrompt -> Graph).

## Button Locations by Screen

### 1. Welcome1 (src/screens/Welcome1.tsx)

**Buttons Present**: None

- **Auto-advance flow**: This screen uses a timer (ONBOARDING_SPLASH_MS, default 4500ms) to auto-advance to Welcome2
- **onSkip prop**: Received but explicitly voided (line 12: `void onSkip;`)
- **UI**: No interactive navigation buttons rendered

---

### 2. Welcome2 (src/screens/Welcome2.tsx)

**Buttons Present**: Back, Skip

#### "Back" Button
- **Location**: Lines 136-138
- **Code**:
  ```tsx
  <button type="button" style={BUTTON_STYLE} onClick={onBack}>
      Back
  </button>
  ```
- **Container**: BUTTON_ROW_STYLE (lines 135-142)
- **Behavior**: Calls `onBack()` callback to return to Welcome1

#### "Skip" Button
- **Location**: Lines 139-141
- **Code**:
  ```tsx
  <button type="button" style={BUTTON_STYLE} onClick={onSkip}>
      Skip
  </button>
  ```
- **Container**: BUTTON_ROW_STYLE (lines 135-142)
- **Behavior**: Calls `onSkip()` callback to bypass onboarding and go directly to Graph

#### "Hide" Button
- **Status**: NOT PRESENT in Welcome2

---

### 3. EnterPrompt (src/screens/EnterPrompt.tsx)

**Buttons Present**: None (delegated to LoginOverlay)

This screen does NOT render buttons directly. Instead, it delegates navigation to the `LoginOverlay` component:

- **Callback passing** (lines 28-34):
  ```tsx
  <LoginOverlay
      open={!user && !isOverlayHidden}
      onContinue={onEnter}
      onBack={onBack}
      onSkip={onSkip}
      onHide={() => setIsOverlayHidden(true)}
  />
  ```

---

### 4. LoginOverlay (src/auth/LoginOverlay.tsx)

**Buttons Present**: Hide, Back, Skip (conditional)

All three buttons are rendered in the button row section (lines 72-108) inside the overlay card.

#### "Hide" Button
- **Location**: Lines 73-80
- **Condition**: Only rendered if `onHide` prop is provided
- **Code**:
  ```tsx
  {onHide && (
      <button
          type="button"
          style={SECONDARY_BUTTON_STYLE}
          onClick={onHide}
      >
          Hide
      </button>
  )}
  ```
- **Behavior**: Dismisses the overlay without navigation (sets `isOverlayHidden` state in EnterPrompt)
- **Style**: SECONDARY_BUTTON_STYLE (transparent background)

#### "Back" Button
- **Location**: Lines 82-89
- **Condition**: Only rendered if `onBack` prop is provided
- **Code**:
  ```tsx
  {onBack && (
      <button
          type="button"
          style={SECONDARY_BUTTON_STYLE}
          onClick={onBack}
      >
          Back
      </button>
  )}
  ```
- **Behavior**: Returns to Welcome2 screen
- **Style**: SECONDARY_BUTTON_STYLE (transparent background)

#### "Skip" Button
- **Location**: Lines 99-106
- **Condition**: Only rendered if `onSkip` prop is provided
- **Code**:
  ```tsx
  {onSkip && (
      <button
          type="button"
          style={SECONDARY_BUTTON_STYLE}
          onClick={onSkip}
      >
          Skip
      </button>
  )}
  ```
- **Behavior**: Bypasses auth/onboarding and goes directly to Graph
- **Style**: SECONDARY_BUTTON_STYLE (transparent background)

---

## Button Summary Matrix

| Screen | Back | Skip | Hide | Notes |
|--------|------|------|------|-------|
| Welcome1 | No | No* | No | onSkip prop voided (not rendered) |
| Welcome2 | Yes | Yes | No | Both in BUTTON_ROW_STYLE |
| EnterPrompt | No | No | No | Delegates to LoginOverlay |
| LoginOverlay | Yes | Yes | Yes | All conditional in BUTTON_ROW |

\* Welcome1 receives `onSkip` prop but explicitly voids it (line 12)

## Implementation Notes

1. **Button Styles**:
   - Welcome2 buttons use: `BUTTON_STYLE` (transparent background, #c7cbd6 color)
   - LoginOverlay buttons use: `SECONDARY_BUTTON_STYLE` (same visual style)
   - LoginOverlay "Continue" button uses: `PRIMARY_BUTTON_STYLE` (#1f2430 background)

2. **Conditional Rendering**:
   - LoginOverlay buttons only render if their corresponding callback prop is defined
   - This allows the same component to be reused in different contexts with varying button sets

3. **Pointer Safety**:
   - LoginOverlay has `onPointerDown={(e) => e.stopPropagation()}` on backdrop (line 37) and card (line 40)
   - This prevents the canvas from stealing pointer events, in compliance with POINTER CAPTURE BUBBLING doctrine

4. **Input Blocking**:
   - LoginOverlay blocks page scroll when open (lines 23-30 set `body.overflow = 'hidden'`)
   - Wheel events are stopped at the overlay level (line 38)

## File References

- `src/screens/Welcome1.tsx` (line 12: void onSkip)
- `src/screens/Welcome2.tsx` (lines 136-141: Back and Skip buttons)
- `src/screens/EnterPrompt.tsx` (lines 28-34: LoginOverlay integration)
- `src/auth/LoginOverlay.tsx` (lines 73-106: Hide, Back, Skip buttons)