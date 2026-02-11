# Welcome2 Text AA Cursor Fix Report

Date: 2026-02-11

## Scope
- Audit and harden Welcome2 typing cursor path to prevent harsh text edges on Windows Chrome.

## Changes
- Updated `src/components/TypingCursor.tsx`.
- Removed layer-promotion hint from cursor style:
  - removed `willChange: 'opacity'`
  - removed legacy transform hint comment that previously referenced `translateZ(0)`
- Added safety comment near `CURSOR_STYLE`:
  - do not add `transform`/`translateZ`/`will-change`/`filter`/`backdrop-filter` in this path because it can break subpixel AA on Windows Chrome.
- Kept blink behavior with text-safe animation only:
  - `typing` mode now uses `cursorNeedleTyping` (opacity-only keyframes)
  - `pause`, `holdFast`, `normal` remain opacity-only keyframe animations

## Keyframes Location
- Cursor blink keyframes live in `src/index.css`:
  - `@keyframes cursorNeedleNormal`
  - `@keyframes cursorNeedlePause`
  - `@keyframes cursorNeedleHoldFast`
  - `@keyframes cursorNeedleTyping`

## Verification
- Static audit complete:
  - no `transform`, `translateZ`, `translate3d`, `scale`, `rotate`, `filter`, `backdrop-filter`, `will-change`, or `willChange` in:
    - `src/components/TypingCursor.tsx`
    - `src/screens/Welcome2.tsx`
    - cursor keyframes in `src/index.css`
- Manifesto container chain in `src/screens/Welcome2.tsx` has no opacity reduction on parent wrappers (`ROOT_STYLE`, `CONTENT_STYLE`, `TEXT_STYLE` do not set `opacity < 1`).

## Outcome
- Root-cause trigger for harsh edges (cursor layer promotion) is removed in code.
- Expected visual result on Windows Chrome at 100% zoom: smooth/stable text AA restored.
