# Welcome2 Seek Run 3 - Controls Wiring

Date: 2026-02-14

## Scope
- Wired Welcome2 sentence seek controls to deterministic timeline seeking.

## Changes
- Updated `src/screens/Welcome2.tsx`:
  - Imported `buildWelcome2SentenceSpans` and `sentenceIndexForCharCount`.
  - Computed sentence spans once from `builtTimeline.renderText`.
  - Consumed `seekToMs` from `useTypedTimeline`.
  - Added helper to map target char count to timeline ms via `builtTimeline.events[target-1].tMs`.
  - Added always-visible ghost controls under manifesto text:
    - `"[<-]"` restart current sentence
    - `"[->]"` finish current sentence
  - Restores root focus after seek.
  - Added pointer down stop-propagation on seek controls.

## Behavior
- `"[->]"` seeks to sentence end char count (exclusive boundary resolved to event time).
- `"[<-]"` seeks to sentence start char count.
- Both actions operate on current sentence resolved from `visibleCharCount`.

## Verification
- `npm run build` passed.

## Risk
- Medium-low. Control wiring depends on sentence lookup and event time mapping.
