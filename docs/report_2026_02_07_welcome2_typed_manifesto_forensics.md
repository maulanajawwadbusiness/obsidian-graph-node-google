# Welcome2 Typed Manifesto Forensics
Date: 2026-02-07
Scope: Forensic scan for implementing sharp and tight typed manifesto on onboarding screen 2 with synced cursor and synced typing SFX.
Status: Scan and analysis only. No feature implementation in this report.

## 1) File map and evidence summary

### A. Onboarding screen2 and flow wiring
- `src/screens/Welcome2.tsx:10`
  - Screen 2 component is `Welcome2`.
  - `MANIFESTO_TEXT` is local constant in component scope at `src/screens/Welcome2.tsx:11`.
  - Auto advance currently uses one timeout in `useEffect` with `ONBOARDING_MANIFESTO_MS` at `src/screens/Welcome2.tsx:20`.
  - Navigation controls currently rendered as `Back` and `Skip` buttons at `src/screens/Welcome2.tsx:39`.
- `src/screens/AppShell.tsx:17`
  - State machine is local and explicit: `welcome1 | welcome2 | prompt | graph`.
  - `Welcome2` mount path is `if (screen === 'welcome2')` at `src/screens/AppShell.tsx:79`.
  - Transition wiring:
    - Back: `setScreen('welcome1')` at `src/screens/AppShell.tsx:83`
    - Next: `setScreen('prompt')` at `src/screens/AppShell.tsx:84`
    - Skip: `setScreen('graph')` at `src/screens/AppShell.tsx:85`
  - Graph is lazy loaded only in `screen === 'graph'` branch at `src/screens/AppShell.tsx:55`.
- `src/config/env.ts:8`
  - Existing timing knobs:
    - `ONBOARDING_SPLASH_MS` default 4500
    - `ONBOARDING_MANIFESTO_MS` default 6000
  - Both clamped to minimum 500 ms.
- `src/components/FullscreenButton.tsx:11`
  - Fullscreen control is a shared component.
- `src/screens/AppShell.tsx:35`
  - Fullscreen button is shown for all onboarding screens (`welcome1`, `welcome2`, `prompt`).

### B. Typography and cursor continuity (screen1 to screen2)
- `src/screens/Welcome1.tsx:53`
  - Screen1 already has explicit cursor element (`|`) and delayed reveal.
- `src/screens/Welcome1.tsx:105`
  - Cursor style: monospace, `animation: 'blink 1s step-end infinite'`, color `#63abff`.
- `src/index.css:153`
  - Global `@keyframes blink` exists and is shared.
- `src/screens/Welcome2.tsx:32`
  - Existing text hook points are already present:
    - `id="welcome2-manifesto-text"`
    - `className="welcome2-typable-text"`
- Finding:
  - No shared typed text utility currently exists for onboarding.
  - Screen2 currently has no cursor element; only static manifesto text block.

### C. Input ownership and lock patterns
- `src/index.css:29`
  - `body { overflow: hidden; }` globally prevents page scrolling.
- `src/auth/LoginOverlay.tsx:35`
  - Overlay ownership pattern blocks input with backdrop and explicit pointer and wheel handling.
  - Uses `onPointerDown` and `onWheel` stop propagation at `src/auth/LoginOverlay.tsx:37`.
- `src/components/FullscreenButton.tsx:35`
  - Overlay button uses `onPointerDown` stop propagation.
- `src/components/AnalysisOverlay.tsx:17`
  - Blocking overlay pattern uses `pointerEvents: 'all'` and prevents input events.
- `src/screens/Welcome2.tsx:40`
  - Current Back/Skip buttons do not use `onPointerDown` stop propagation.
  - This is low risk today because graph is not mounted during welcome2, but adding explicit stop propagation keeps doctrine consistency.

### D. Audio infra scan
- `package.json`
  - No audio library dependency (no howler, no tone, no use-sound package).
  - No animation library dependency (no framer-motion).
- `src` scan results:
  - No existing `AudioContext` usage.
  - No `new Audio(...)` usage.
  - No typed SFX infra or sound manager.
- Asset bundling pattern:
  - Static assets are imported from `src/assets/*` (example: `src/components/FullscreenButton.tsx:3`).
  - `public/` is used for some static worker/font files only.
- Gesture gating context:
  - No global audio unlock or SFX toggle currently exists.
  - App runs under React StrictMode at `src/main.tsx:15`.

### E. Existing timing and animation loop patterns relevant to typed engine
- `src/screens/Welcome2.tsx:20`
  - Existing timer based transition seam.
- `src/fullchat/FullChatbar.tsx:195`
  - Existing in-repo example of deterministic time based progressive text reveal using `requestAnimationFrame`, `performance.now`, and guarded refs.
  - Contains instrumentation counters and strict mode guard patterns.
- Finding:
  - Reusing this style (time based progression + guard refs + cleanup) aligns with 60fps doctrine and existing codebase patterns.

### F. Logging and instrumentation patterns
- Repo uses direct `console.log` and `console.warn` with tags.
  - Examples: `[Prefill]` in `src/fullchat/prefillSuggestion.ts:45`, `[fullscreen]` in `src/hooks/useFullscreen.ts:44`.
- No centralized logger required for this task.
- Best fit: scoped tags like `[Welcome2Type]` and `[Welcome2Sfx]`.

## 2) Recommended architecture (component and hook split)

### Recommendation
- Add a local reusable typing engine hook:
  - `src/hooks/useTypedText.ts`
- Add optional local SFX hook for onboarding typing:
  - `src/hooks/useTypingSfx.ts`
- Keep `Welcome2` as orchestration view only:
  - source text
  - typed engine config
  - nav gating logic
  - button handlers

### Why this split
- Minimal diff in onboarding screen tree.
- Reusable for future typed UX (Welcome1 subtitle, PromptCard dynamic word).
- Keeps render and timing logic out of screen JSX.
- Supports strict cleanup, logs, and testability.

### Render strategy choice
- Chosen: `requestAnimationFrame` time based engine in hook, with char index emitted from elapsed time and pause rules.
- Avoid pure `setInterval` character ticking:
  - more drift under tab throttling
  - weaker sync with audio timing
- Avoid per frame React state churn:
  - only update state when visible character index changes.
  - cursor blink remains CSS driven.

### Proposed typed engine contract
- Inputs:
  - `text`
  - `baseCharMs`
  - `punctuationPauseMs`
  - `sentencePauseMs`
  - `paragraphPauseMs`
  - `startDelayMs`
  - `enabled`
- Outputs:
  - `visibleText`
  - `charIndex`
  - `isComplete`
  - `startedAtMs`
  - `lastTickMs`
  - `completeAtMs`
  - handlers: `skipToEnd()`, `restart()`

## 3) Audio implementation plan (sharp and tight sync)

### Chosen method
- Web Audio API using `AudioContext`, decoded `AudioBuffer`, and `AudioBufferSourceNode` per keystroke event.

### Why Web Audio over HTMLAudio pool
- Lower and more consistent trigger latency.
- Precise scheduling using context time.
- Native pitch and gain variation without reloading or duplicating files.
- Better chance of character to sound sync than HTMLAudio element clones.

### Preload and warm plan
- Put short dry typing sample in `src/assets/sfx/typing_key_01.wav` (or similar).
- In `useTypingSfx`:
  - lazy create `AudioContext`.
  - fetch and decode buffer once on mount or first interaction.
  - keep decoded buffer in ref.
- Warm strategy:
  - call `audioCtx.resume()` on first user gesture (`pointerdown` or keydown) at screen level.
  - if context remains suspended, fail soft with muted mode and log once.

### Sync plan
- Trigger SFX in same loop tick where char index increments.
- For each emitted character:
  - record `charRenderTs = performance.now()`.
  - trigger buffer source immediately and record `audioTriggerTs = performance.now()`.
  - compute `audio_latency_ms = audioTriggerTs - charRenderTs`.
- Emit batched debug logs every N chars to avoid console spam.

### Micro variation plan
- Randomize per hit without reloading:
  - playbackRate: 0.97 to 1.03
  - gain: 0.95 to 1.05
- Skip SFX for spaces and optionally for line breaks.
- Optional punctuation rule:
  - lower volume for punctuation or suppress punctuation sound if desired.

### No global SFX toggle found
- Add local knob first (component prop or local constant).
- If product needs global sound policy later, follow store pattern used by other UI stores.

## 4) Risk list

1. Autoplay and gesture restrictions
- Welcome2 can be reached via auto transition from Welcome1 without user gesture.
- Audio may be blocked until explicit interaction.
- Mitigation: gesture unlock path and silent fallback.

2. StrictMode double effects in dev
- React StrictMode is enabled at `src/main.tsx:15`.
- Typing loops and audio setup can double run if cleanup is weak.
- Mitigation: guard refs, idempotent setup, full cleanup on unmount.

3. Timing drift between typing and auto advance
- Current welcome2 auto advance timer is independent from typing completion.
- Mitigation: gate auto advance by typing completion or compute total typing duration and derive timeout.

4. Excessive re-renders
- Per char state updates are acceptable for this small screen, but still should be bounded.
- Mitigation: update only when index changes, memoize static style objects, keep hook local.

5. Audio jitter on low end devices
- Rapid source creation can jitter under CPU pressure.
- Mitigation: keep SFX sample tiny, avoid long effect chains, skip sound on some chars when cadence is too fast.

6. Input ownership doctrine drift
- Welcome2 currently has no explicit pointerdown stop on nav buttons.
- Mitigation: add stop propagation to interactive controls for consistency with overlay doctrine.

7. Mobile browser quirks
- iOS Safari can keep context suspended or delay resume.
- Mitigation: resume on explicit tap and keep fallback behavior non blocking.

## 5) Proposed knobs (constants)

### Timing knobs
- `ONBOARDING_MANIFESTO_START_DELAY_MS = 120`
- `ONBOARDING_MANIFESTO_BASE_CHAR_MS = 28`
- `ONBOARDING_MANIFESTO_SPACE_CHAR_MS = 18`
- `ONBOARDING_MANIFESTO_PUNCTUATION_PAUSE_MS = 90`
- `ONBOARDING_MANIFESTO_SENTENCE_PAUSE_MS = 180`
- `ONBOARDING_MANIFESTO_PARAGRAPH_PAUSE_MS = 300`
- `ONBOARDING_MANIFESTO_CURSOR_BLINK_MS = 1000` (already effectively 1s via CSS)

### SFX knobs
- `ONBOARDING_MANIFESTO_SFX_ENABLED = true`
- `ONBOARDING_MANIFESTO_SFX_GAIN = 0.16`
- `ONBOARDING_MANIFESTO_SFX_GAIN_JITTER = 0.05`
- `ONBOARDING_MANIFESTO_SFX_PITCH_JITTER = 0.03`
- `ONBOARDING_MANIFESTO_SFX_SKIP_SPACES = true`
- `ONBOARDING_MANIFESTO_SFX_MIN_INTERVAL_MS = 14`

### Navigation gating knobs
- `ONBOARDING_MANIFESTO_ALLOW_SKIP_DURING_TYPING = true`
- `ONBOARDING_MANIFESTO_ALLOW_BACK_DURING_TYPING = true`
- `ONBOARDING_MANIFESTO_AUTO_ADVANCE_ON_COMPLETE = true`
- `ONBOARDING_MANIFESTO_AUTO_ADVANCE_DELAY_AFTER_COMPLETE_MS = 350`

## 6) Recommended UX policy for lock behavior

- Keep `Skip` active at all times.
- Keep `Back` active at all times.
- Replace fixed absolute timeout with completion based advance.
- If user clicks `Skip`, bypass remaining typing and navigate immediately.
- If user clicks `Back`, cancel typing loop and audio loop cleanly.

Rationale:
- Preserves user control.
- Avoids feeling trapped.
- Still supports cinematic typed manifesto by default.

## 7) Instrumentation plan for implementation phase

### Log tags
- `[Welcome2Type]`
- `[Welcome2Sfx]`

### Metrics to emit
- `typed_char_count`
- `last_tick_ms`
- `render_progress_pct`
- `audio_latency_ms`
- `audio_resume_state`
- `typing_total_ms`

### Sync quality measurement
- At each emitted char:
  - `char_render_ts = performance.now()`
  - `audio_trigger_ts = performance.now()`
  - `delta = audio_trigger_ts - char_render_ts`
- Aggregate every 20 chars:
  - avg delta
  - p95 delta
  - max delta

## 8) Final forensic conclusions

- Flow wiring is clean and centralized in `AppShell`; Welcome2 is safe to extend without touching graph internals.
- Cursor continuity is available now through shared blink keyframes and Welcome1 cursor style baseline.
- There is no existing audio stack; Web Audio is the correct fit for tight sync and low latency.
- Best implementation path is modular hooks plus a small Welcome2 orchestration diff.
- Main technical risk is audio autoplay restrictions; this must be handled as a first class fallback, not as an afterthought.
