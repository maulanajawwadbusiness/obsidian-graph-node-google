# Forensic Session Report: Welcome2 Typing and Cadence Work
Date: 2026-02-08
Branch: typing-manifesto
Scope: Welcome2 typing cadence, timeline semantics, visual stability, cursor behavior, and onboarding interaction hardening

## 1) Executive Summary
This session series moved Welcome2 from static/linear manifesto rendering to a deterministic timeline-driven typing system with authored rhythm and semantic cadence. The work introduced marker parsing, cadence presets, timeline build rules, strict rAF-driven visibility, cursor unification, gesture/input safety, and multiple tuning passes focused on perceived readability and emotional cadence.

The highest-value outcomes:
- Deterministic text reveal based on timeline timestamps (not frame-step increments).
- Marker-aware manifesto source where markers are stripped in rendered output.
- Centralized cadence tuning in config with semantic controls.
- Newline and paragraph timing rules tuned for intentional line-drop feel.
- Shared needle cursor between welcome screens.
- Input guard fixes preserving accessibility.
- Visual stability mitigations (text shaping lock option and focus-ring toggle).

No audio path was retained.

## 2) Timeline of Significant Commits
Most relevant commits in this stream:

1. `65e8e60` welcome2: add authored rhythm markers to manifesto text
2. `289764c` welcome2: add cadence config presets for typed manifesto
3. `b38060e` welcome2: add deterministic timeline builder for manifesto typing
4. `e5661b1` welcome2: strip manifesto markers at runtime render
5. `c012df6` welcome2: add visual typing engine driven by manifesto timeline
6. `ea9210f` welcome2: reduce per-frame rerenders in typed timeline hook
7. `4cb9e12` onboarding: unify needle cursor across welcome screens
8. `b323e8d` onboarding: add gesture unlock + prevent scroll during typing
9. `1faf03c` welcome2: wire manifesto typing + needle cursor into screen
10. `85ffe58` welcome2: preserve button Space activation in scroll key guard
11. `23436fb` welcome2: add typing instrumentation + verification toggles
12. `83bc941` welcome2: slow manifesto typing cadence by ~30 percent
13. `e48f2ec` welcome2: rich cadence tuning (less linear, more intentional pauses)
14. `2d22e64` welcome2: attach newline cost before line break events
15. `401f678` welcome2: refine newline cluster timing for costly pre-drop cadence
16. `3020c39` docs: add forensic handoff for welcome typing session
17. `78bf4af` welcome2: tune newline cadence split and double-break mechanical weight
18. `1aa35ac` welcome2: restore natural text rendering and make typing cursor static
19. `1d75b83` welcome2: semantic cadence v2 with word-end breath and heavy-word landing pauses
20. `138062e` welcome2: tune semantic cadence intensity from 3x to 2x
21. `cb68d1e` welcome2: smooth semantic cadence with distributed transition pauses
22. `9655778` welcome2: lock text shaping to prevent spacing reshaping during typing
23. `f97f800` welcome2: add focus-ring visibility toggle and hide root ring

## 3) Files and System Changes

### A. Text source and marker strategy
- `src/screens/welcome2ManifestoText.ts`
- Markers in source use `{p=###}`.
- Runtime render uses marker-stripped text from timeline builder output.

### B. Cadence config as single tuning seam
- `src/config/onboardingCadence.ts`
- Added structured `CadenceConfig`.
- Added preset model (`fast`, `normal`, `slow`) and speed apply helper.
- Added semantic cadence block for heavy words and sentence landings.

### C. Deterministic timeline builder
- `src/screens/welcome2Timeline.ts`
- Responsibilities:
  - parse and strip markers
  - build render text and event timeline
  - assign deterministic event timestamps
  - apply punctuation/newline/paragraph/macro semantic pauses
- Newline behavior underwent several tuning passes:
  - pre-drop cost
  - wrapped split around drops
  - double-newline mechanical weighting
  - paragraph/marker anti-mush handling

### D. Visual typing engine
- `src/hooks/useTypedTimeline.ts`
- Uses `requestAnimationFrame` + elapsed time + binary search.
- Exposes visible count/text, phase (`typing`, `hold`, `done`), elapsed.
- Includes strict monotonic guard and optional debug summary metrics.

### E. Welcome2 wiring and interaction guards
- `src/screens/Welcome2.tsx`
- Full dataflow wired:
  - `MANIFESTO_TEXT` -> `buildWelcome2Timeline(...)` -> `useTypedTimeline(...)` -> render.
- Added root focus behavior for keyboard guard needs.
- Added focus ring visibility toggle:
  - `SHOW_WELCOME2_FOCUS_RING` (currently false).
- Added text shaping lock options to reduce re-shape artifacts.

### F. Shared cursor
- `src/components/TypingCursor.tsx`
- Shared across Welcome1/Welcome2.
- Typing mode set to static in latest pass to reduce perceived micro-motion noise.

### G. Instrumentation
- `src/utils/typingMetrics.ts`
- `useTypedTimeline` instrumentation and summary logging.
- Timeline debug hooks:
  - `?debugType=1` for hook metrics
  - `?debugCadence=1` for cadence/semantic proof logs

## 4) Critical Behavioral Rules (Current)

1. Render must never show raw marker tokens.
- Always render `BuiltTimeline.renderText`, not source text with markers.

2. Timeline determinism is mandatory.
- Visibility is derived from elapsed time against event timestamps.
- No frame-count increment model.

3. Newline semantics are explicit.
- `\\n` and `\\n\\n` use dedicated timing logic.
- Double newline includes additional mechanical weighting and paragraph semantics.

4. Semantic cadence currently prefers pause distribution over per-letter jitter.
- Word-end and landing pauses are distributed across short local ramps.
- This reduces hard-stop sensation while keeping semantic weight perceptible.

5. Accessibility and interaction safeguards remain required.
- Space key scroll prevention must not block button activation.
- Wheel and focus guards must not break Back/Skip behavior.

## 5) Visual Stability Findings
Observed issue class: perceived character phase/slip during typing.

Likely contributors:
- glyph shaping and spacing reflow under dynamic append
- cursor proximity at wrap boundaries
- contrast/smoothing perception on dark background
- cadence transitions that feel abrupt when pause concentration is too localized

Mitigations applied in this stream:
- optional shaping lock in Welcome2 text style
- static typing cursor mode
- semantic pause redistribution (ramp) to reduce abrupt full-stop effect

## 6) Open Risks and Follow-up
Known remaining concerns from live perception:
- some users may still perceive micro-noise under certain browser/DPR/zoom/font states
- shaping-lock tradeoff can reduce typographic softness
- cursor in-flow can still influence wrapping near edge conditions

Tracking:
- Added dedicated section in `docs/FUTURE_TODO.md`:
  - `Welcome2 Typing Visual Stability (Chars Phase In/Out)`

## 7) What To Preserve in Future Work
1. Keep timeline and hook deterministic.
2. Keep marker stripping invariant.
3. Treat cadence config as the only tuning truth.
4. Avoid ad-hoc per-frame visual tricks that hide timing problems.
5. Validate perceived quality on real hardware settings (browser + DPR + zoom).

## 8) Current Workspace State Notes
At report time:
- Untracked doc from earlier pass exists:
  - `docs/report_2026_02_08_welcome2_semantic_cadence_implementation.md`
- This report is the consolidated forensic record for all Welcome2 typing work in this session.
