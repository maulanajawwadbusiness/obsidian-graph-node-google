# Forensic Session Report: Welcome Onboarding Typing Work
Date: 2026-02-08
Branch: typing-manifesto
Scope: Welcome1 and Welcome2 typing cadence, timeline, cursor unification, interaction safety, and diagnostics

## Executive Summary
This session transformed Welcome2 typing from static or linear rendering into a deterministic timeline-driven system with authored rhythm markers, cadence presets, and a shared needle cursor with Welcome1. The work stayed in a no-audio model. The timeline engine now controls character visibility and pause semantics, including newline and paragraph behavior designed for pre-drop carriage-return feel.

The final tuning state emphasizes:
- Tight and intentional cadence (not conveyor linear)
- Marker-aware authored rhythm
- Deterministic timing under frame drops and tab switches
- Shared cursor identity between Welcome1 and Welcome2
- Onboarding flow protection against accidental scroll and gesture-gated fullscreen friction

## Commit Timeline (most relevant, newest first)
1. `401f678` welcome2: refine newline cluster timing for costly pre-drop cadence
2. `2d22e64` welcome2: attach newline cost before line break events
3. `e48f2ec` welcome2: rich cadence tuning (less linear, more intentional pauses)
4. `83bc941` welcome2: slow manifesto typing cadence by ~30 percent
5. `23436fb` welcome2: add typing instrumentation + verification toggles
6. `85ffe58` welcome2: preserve button Space activation in scroll key guard
7. `1faf03c` welcome2: wire manifesto typing + needle cursor into screen
8. `b323e8d` onboarding: add gesture unlock + prevent scroll during typing
9. `4cb9e12` onboarding: unify needle cursor across welcome screens
10. `ea9210f` welcome2: reduce per-frame rerenders in typed timeline hook
11. `c012df6` welcome2: add visual typing engine driven by manifesto timeline
12. `e5661b1` welcome2: strip manifesto markers at runtime render

## Files Added or Modified and Why

### 1) Manifesto source and marker strategy
- `src/screens/welcome2ManifestoText.ts`
- Marker grammar in use: `{p=###}`
- Current cadence shaping:
  - one early marker increased to `{p=260}`
  - marker after the "50 years" sentence removed
  - two deep breaths `{p=900}` retained
- Purpose: authored rhythm in source text while preserving rendered copy via stripping.

### 2) Cadence configuration and tuning
- `src/config/onboardingCadence.ts`
- Introduced typed cadence model and presets with tuning concentrated in one module.
- Normal profile moved to rich values (tight but breathing), with fast and slow derived by scale.
- No typing engine rewrites needed for tuning passes.

### 3) Deterministic timeline builder
- `src/screens/welcome2Timeline.ts`
- Core responsibilities:
  - parse markers
  - strip markers from render text
  - classify emitted chars
  - assign deterministic event times and pause reasons
- Critical behavior now:
  - explicit marker pause wins for attached char
  - malformed marker falls back to marker default and warns once
  - newline cluster handling is explicit
  - paragraph anti-mush logic avoids additive semantic dead zones

### 4) Typing engine hook
- `src/hooks/useTypedTimeline.ts`
- Timeline-driven rAF loop based on elapsed time and binary search, not tick-per-char increments.
- Phase model exposed (`typing`, `hold`, `done`) plus visible count/text and elapsed.
- Performance fix included: avoid unnecessary per-frame rerenders when visible state is unchanged.
- Instrumentation support added with one-shot summary logs under debug gate.

### 5) Welcome2 integration
- `src/screens/Welcome2.tsx`
- Wired path: manifesto text -> memoized built timeline -> typed hook -> render text + cursor.
- Render uses stripped text, not raw marker text.
- Added debugType query toggle wiring for metrics.
- Added guard logic against onboarding flow-breaking scroll input.

### 6) Shared cursor identity
- `src/components/TypingCursor.tsx`
- `src/screens/Welcome1.tsx`
- `src/screens/Welcome2.tsx`
- Replaced ad-hoc pipe cursor rendering with shared needle component and mode mapping.
- Important nuance fixed: inline style spread can override `heightEm`; this caused unexpected height behavior when Welcome1 passed height in style object.

### 7) Onboarding gesture unlock and interaction safety
- `src/hooks/useFirstUserGesture.ts`
- `src/ui/AppShell.tsx`
- `src/screens/Welcome2.tsx`
- First user gesture can retry fullscreen once without forcing click-to-start typing.
- Space and wheel scroll flow guards added for onboarding context.
- Keyboard activation safety was corrected so Space on focused buttons (Back/Skip) still works.

### 8) Metrics helpers
- `src/utils/typingMetrics.ts`
- Small dependency-free stats helpers for quantiles/avg/clamp and timing wrappers.

### 9) Documentation reports produced during session
- `docs/report_2026_02_07_welcome2_manifesto_authored_rhythm.md`
- `docs/report_2026_02_07_welcome2_cadence_config.md`
- `docs/report_2026_02_07_welcome2_timeline_builder.md`
- `docs/report_2026_02_07_welcome2_visual_typing_engine.md`
- `docs/report_2026_02_07_welcome_cursor_needle_unification.md`
- `docs/report_2026_02_07_onboarding_gesture_unlock.md`
- `docs/report_2026_02_07_welcome2_full_wiring.md`
- `docs/report_2026_02_07_welcome2_instrumentation_verification.md`

## Deep Technical Nuances Future Agent Must Preserve

1. Marker stripping is mandatory at render path.
- Never render `MANIFESTO_TEXT` raw in Welcome2.
- Render must come from timeline builder `renderText`.

2. Determinism contract.
- Visibility must be derived from elapsed time against event timestamps.
- Do not increment by frame tick count.
- This ensures resilience to stutter, dropped frames, and tab backgrounding.

3. Newline timing semantics are now pre-drop, not post-drop.
- Single `\n`: wait first, then emit newline event (drop feels costly and sharp).
- Double `\n\n`: two mechanical pre-drop waits plus semantic paragraph pause.

4. Anti-mush paragraph rule with marker interaction.
- Marker and paragraph semantic pauses do not blindly sum.
- Paragraph contribution is computed to avoid long dead voids near marker-decorated boundaries.

5. Scroll guard must not break keyboard activation.
- Root-level Space prevention can block button default activation via bubbling.
- Keep guard scoped so Back/Skip remain keyboard accessible.

6. Cursor height override trap.
- In shared cursor component, spread order of style props can override computed height.
- If `style.height` is present in screen-level constants, it will defeat `heightEm`.
- Keep one source of truth for cursor height per screen to avoid confusion.

7. Performance discipline.
- Avoid state writes every frame when derived render state did not change.
- Keep debug logs gated and sampled, not per-frame spam.

## Known Tuning State and Open Questions
- Typing is less linear than before and includes richer sentence breathing.
- Newline mechanics were refined twice; latest behavior is pre-drop cluster model.
- Additional subjective tuning may still be needed for exact narrative feel on target hardware.
- No audio path exists and should remain absent unless explicitly reintroduced in a future decision.

## Safe Next Steps for Next Session
1. Run a focused cadence-only pass if feel needs more shape.
- Edit only `src/config/onboardingCadence.ts` and minimal marker placements.

2. Validate newline feel in real interaction loops.
- Specifically check perceived weight of single vs double newline transitions.

3. If further cursor changes are needed, preserve shared component parity.
- Do not fork cursor styles per screen unless product decision says so.

4. Keep verification with `?debugType=1` during tuning only.
- Use summary metrics and watch for no regressions in deterministic behavior.

## Final State at End of This Session
- Branch: `typing-manifesto`
- Last code commit before this forensic report: `401f678`
- No build was forced during tuning phases where build was explicitly prohibited.
- Work is staged for continuity and future agent handoff with this forensic record.
