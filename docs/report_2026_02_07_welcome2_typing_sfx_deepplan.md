# Welcome2 Typing SFX Deep Plan
Date: 2026-02-07
Scope: Deep forensic plan for world-grade tight-sync typing SFX on Welcome2, plus cadence control architecture.
Status: Planning only. No feature code in this report.

## 1) Decision summary

- Audio engine: Web Audio API with timeline scheduling (sequencer-style), not naive per-char fire-and-forget.
- Typing and audio synchronization: one shared deterministic timeline clock for both visual reveal and sound events.
- Cadence controls: one typed config object plus optional authored markers in text.
- Unlock strategy: non-blocking audio unlock on first onboarding gesture. If blocked, type silently and retry on next gesture.

Reason:
- Best fit for 60fps doctrine, low latency, strict cleanup, and predictable behavior in React StrictMode.

## 2) Scandissect findings (audio-specific)

### A. Asset and bundling reality check

Evidence:
- `src/vite-env.d.ts:1` includes `/// <reference types="vite/client" />`.
- Vite config is plain and default (`vite.config.ts`), no custom asset blockers.
- Existing pattern imports images from `src/assets/*` directly (example `src/components/FullscreenButton.tsx:3`).
- `public/` is currently used for static worker/font files, not app-level UI assets.

Conclusion:
- `.wav` imports from `src/assets/sfx/*.wav` are valid in this repo with Vite defaults.
- Preferred location: `src/assets/sfx/` because hashed asset URL, cache-busting, and tree wiring are aligned with current patterns.
- `public/` is not needed for typing SFX unless raw non-bundled URL behavior is explicitly required.

Recommended sample specs:
- Format: WAV PCM mono.
- Sample rate: 48kHz preferred, 44.1kHz acceptable.
- Length: 20ms to 80ms, hard max 100ms.
- Tail: minimal tail, no reverb, no room smear.
- Peak: keep headroom (-6 dBFS target peak) to avoid clipping when rapid hits overlap.

Bundle impact estimate:
- 8 mono short wav samples at ~6KB to 20KB each is low footprint.
- Decode once and reuse buffers. No runtime network churn after initial load.

### B. Architecture choice: immediate trigger vs sequencer scheduling

Options:
1. Immediate trigger per char increment.
2. Sequencer-style scheduling from prebuilt char timeline with lookahead window.

Repo patterns considered:
- Scheduler discipline and deterministic timing in `src/playground/rendering/renderLoopScheduler.ts:23`.
- Progressive deterministic stream loop with strict guard refs and perf counters in `src/fullchat/FullChatbar.tsx:195`.
- StrictMode enabled at root in `src/main.tsx:15`.

Decision:
- Choose option 2 (sequencer-style) with shared timeline.

Why option 2 is safer and tighter here:
- Reduces jitter spikes from JS event timing and frame variation.
- Decouples render cadence from audio start precision while preserving sync via shared timeline reference.
- Works better when frame timing hiccups occur because audio is pre-scheduled in small lookahead.
- Cleaner StrictMode handling through one run token and idempotent scheduler state.

Execution model:
- Build deterministic timeline array once at start.
- Visual reveal:
  - rAF computes elapsed and current char index from timeline.
- Audio scheduler:
  - periodically schedule events with `audioCtx.currentTime` for `now + lookaheadSec` window.
  - event selection from same timeline.

Recommended lookahead:
- 0.08s to 0.12s (start with 0.10s).
- scheduler tick every ~25ms.

## 3) Web Audio sound quality tactics feasibility

All required tactics are feasible with standard Web Audio.

### Multi-sample library

Plan:
- 5 to 8 key click variants.
- 1 punctuation tick variant.
- 1 enter/newline tick variant.

Mapping classes:
- `letter` and `digit`: random from key click bank.
- `space`: no sound by default.
- `punct`: punctuation sample or lowered key click.
- `lineBreak` or paragraph: enter sample (subtle).

### Micro-variation per hit

Plan:
- playbackRate jitter: +/-3 percent.
- gain jitter: +/-5 percent.

Implementation notes:
- use `AudioBufferSourceNode.playbackRate.value`.
- route source through per-hit `GainNode`.

### Envelope shaping for tightness

Plan:
- each hit through dedicated gain envelope:
  - attack: 1ms to 2ms.
  - decay: 18ms to 35ms.
  - no release tail smear.

Method:
- `gain.setValueAtTime(0, t0)`
- `gain.linearRampToValueAtTime(targetGain, t0 + attack)`
- `gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay)`

### Limiter or soft-clip

Plan:
- lightweight master chain:
  - optional `DynamicsCompressorNode` with mild threshold and ratio.
  - optional soft clip function only if transients still clip.

Recommendation:
- start with conservative per-hit gain + mild compressor.
- avoid heavy limiting that dulls click transient.

## 4) Gesture gating and fallback plan

Constraint:
- Welcome2 can appear via auto flow with zero user gesture.

Unlock points (recommended):
- Attach unlock listeners on Welcome2 root container and window while screen active:
  - `pointerdown`
  - `keydown`
  - optional `touchstart`
- Also include fullscreen button and nav button interactions naturally through bubbling or explicit call.

Behavior policy:
- If `AudioContext` is suspended:
  - continue typing silently.
  - log once: `[Welcome2Sfx] audio_suspended_silent_fallback`.
  - keep trying resume on next gesture.
- On first successful resume:
  - log once: `[Welcome2Sfx] audio_resumed`.
  - SFX starts immediately for subsequent eligible chars.

Do not block onboarding flow for audio state.

## 5) Exact module and file plan

New modules:
- `src/hooks/useTypingSfx.ts`
  - Responsibilities:
    - manage `AudioContext` lifecycle and unlock.
    - preload/decode sample buffers.
    - schedule hits in lookahead window.
    - maintain per-run scheduler cursor.
    - expose instrumentation stats.
- `src/config/onboardingCadence.ts`
  - typed config object for cadence and SFX knobs.
  - profiles (`fast`, `normal`, `slow`) and default export.
- `src/screens/welcome2Timeline.ts` (or `src/screens/welcome2/typingTimeline.ts`)
  - parser and deterministic timeline builder.
  - supports rule-based cadence and authored markers.

Planned small changes:
- `src/screens/Welcome2.tsx`
  - orchestrate timeline generation.
  - run visual typed engine + invoke sfx scheduler.
  - wire unlock listeners and one-shot logs.
- `src/config/env.ts`
  - optional small additions for debug cadence preset selection only (if needed).

Assets:
- `src/assets/sfx/welcome2_key_01.wav` ... `welcome2_key_08.wav`
- `src/assets/sfx/welcome2_punct_01.wav`
- `src/assets/sfx/welcome2_enter_01.wav`

## 6) Instrumentation plan and tightness criteria

Log tags:
- `[Welcome2Type]`
- `[Welcome2Sfx]`

Metrics to aggregate every 20 chars:
- `typed_char_count`
- `audio_triggered_count`
- `sync_delta_ms_avg`
- `sync_delta_ms_p95`
- `sync_delta_ms_max`
- `scheduler_late_count`
- `scheduler_window_ms`
- `audio_ctx_state`

Delta definition:
- For each char event that should emit sfx:
  - `char_render_ts = performance.now()` at visual commit edge.
  - `audio_trigger_ts = performance.now()` when scheduling call is issued.
  - `sync_delta_ms = audio_trigger_ts - char_render_ts`.

Secondary timing metric:
- `audio_schedule_ahead_ms = (scheduledAudioTime - audioCtx.currentTime) * 1000`.

Tightness acceptance targets (manual):
- avg sync delta within +/-8ms.
- p95 sync delta within +/-16ms.
- no audible flam or double hits in normal cadence profile.
- no frame hitching caused by scheduler (no repeated slow tick warnings).

## 7) Manual verification plan (Win11 Chrome)

Environment:
- Windows 11, latest Chrome stable, dev build.
- Use default audio output and then test with bluetooth headset once.

Procedure:
1. Start app with onboarding enabled and open console.
2. Reach Welcome2 without clicking anything.
3. Confirm text types and no sound before gesture.
4. Click once on screen, confirm single resume log and sound starts for next chars.
5. Observe logs every 20 chars for delta stats.
6. Compare by ear:
   - no lag sensation between glyph reveal and click.
   - no smeared tail in rapid segments.
7. Stress pass:
   - switch tab briefly and return.
   - ensure no burst of stale audio events.
8. Back and Skip tests:
   - verify scheduler cancels cleanly, no stray clicks after navigation.

Pass criteria:
- zero audible desync under normal load.
- no leaked audio after unmount.
- no blocked navigation due to audio state.

## 8) Cadence Control Plan

Goal:
- Tune rhythm like a sequencer without rewriting core logic.

### 8.1 Where to store cadence config

Recommendation:
- Primary source: typed config file `src/config/onboardingCadence.ts`.
- Optional override source: env preset key only (example `VITE_ONBOARDING_CADENCE_PRESET`).

Why:
- Rich typed structure does not fit env vars cleanly.
- Easy hot tuning in dev by editing one object.
- Keeps defaults centralized and testable.

### 8.2 Config schema (TypeScript)

```ts
export type CadencePresetName = 'fast' | 'normal' | 'slow';

export type CadenceRuleConfig = {
  baseCharMs: number;
  spaceMs: number;
  commaPauseMs: number;
  periodPauseMs: number;
  questionPauseMs: number;
  exclamationPauseMs: number;
  colonPauseMs: number;
  semicolonPauseMs: number;
  lineBreakPauseMs: number;
  paragraphPauseMs: number;
  afterSentenceExtraMs: number;
  endHoldMs: number;
  speedMultiplier: number;
};

export type CadenceSfxConfig = {
  enabled: boolean;
  minSfxIntervalMs: number;
  skipSpaces: boolean;
  gain: number;
  gainJitter: number;
  pitchJitter: number;
};

export type AuthoredBeatMap = {
  [beatName: string]: number;
};

export type OnboardingCadenceConfig = {
  preset: CadencePresetName;
  rule: CadenceRuleConfig;
  beats: AuthoredBeatMap;
  sfx: CadenceSfxConfig;
};
```

Suggested defaults (normal):
- `baseCharMs: 28`
- `spaceMs: 16`
- `commaPauseMs: 70`
- `periodPauseMs: 150`
- `questionPauseMs: 170`
- `lineBreakPauseMs: 180`
- `paragraphPauseMs: 320`
- `afterSentenceExtraMs: 40`
- `endHoldMs: 350`
- `minSfxIntervalMs: 14`
- `speedMultiplier: 1.0`

### 8.3 Authored cadence markers in text

Marker grammar (lightweight):
- `{p=300}` explicit pause of 300ms.
- `{beat}` named beat from config map.
- `{beat:thinking}` optional explicit named form.
- `\n\n` auto paragraph pause.

Parser behavior:
- Strip markers from rendered text.
- Convert markers into timeline pause events.
- Unknown beat names:
  - ignore marker or fallback to safe default and log warning once.

Example source text:
```text
For me, i often feel tired reading paper at 2 am.{p=220}
I think text is not the most intuitive form of knowledge.{beat:heavy}

I think it is time for us to think differently.
```

Example beat map:
```ts
beats: {
  beat: 140,
  heavy: 260,
  breath: 180
}
```

### 8.4 Deterministic timeline generation

Output shape:
```ts
type TimelineEvent = {
  charIndex: number;
  tMs: number;
  sfx: boolean;
  class: 'letter' | 'digit' | 'space' | 'punct' | 'lineBreak';
  pauseReason: 'base' | 'space' | 'comma' | 'period' | 'question' | 'lineBreak' | 'paragraph' | 'marker' | 'beat';
};
```

Generation steps:
1. Parse raw text into render chars plus marker tokens.
2. Walk chars sequentially and compute delta from rule config.
3. Inject marker pauses at current timeline cursor.
4. Apply `speedMultiplier` globally after per-event deltas.
5. Mark `sfx` eligibility by char class and min interval rule.

Determinism rule:
- same text + same config + same beat map = same timeline array.

Example timeline rows:
```text
[{charIndex:0, tMs:0,   sfx:true,  class:'letter',    pauseReason:'base'},
 {charIndex:1, tMs:28,  sfx:true,  class:'letter',    pauseReason:'base'},
 {charIndex:2, tMs:56,  sfx:false, class:'space',     pauseReason:'space'},
 {charIndex:3, tMs:72,  sfx:true,  class:'letter',    pauseReason:'base'},
 {charIndex:14,tMs:420, sfx:true,  class:'punct',     pauseReason:'period'},
 {charIndex:15,tMs:610, sfx:true,  class:'letter',    pauseReason:'marker'}]
```

### 8.5 Tuning surface

Primary tuning surface:
- exported object in `src/config/onboardingCadence.ts`.

Optional dev-only selector:
- query param `?cadence=fast|normal|slow`.
- keep it dev-only and no production dependence.

Potential simple runtime debug knobs:
- `window.__welcome2CadenceOverride` (dev only) for fast tuning.

### 8.6 Plug point into Welcome2 engine

Integration seam:
- `Welcome2` builds timeline once from `MANIFESTO_TEXT` + cadence config.
- visual typed hook reads timeline to determine visible char index.
- `useTypingSfx` consumes same timeline and schedules only eligible sfx events.
- navigation actions cancel run token and scheduler immediately.

## 9) Risk register for this phase

1. Autoplay restrictions can suppress sound on first pass.
- Mitigation: silent fallback + gesture resume.

2. StrictMode double-run can duplicate schedulers.
- Mitigation: run tokens, idempotent start guards, cleanup in effect return.

3. Over-scheduling can play stale events after navigation.
- Mitigation: cancel by run token and do not schedule beyond active timeline cursor.

4. Sample tails can blur rhythm.
- Mitigation: short dry samples + enforced envelope decay.

5. Too many env knobs create drift between profiles.
- Mitigation: one typed config object as single source of truth.

## 10) Implementation readiness checklist

- [x] bundling path decided (`src/assets/sfx`).
- [x] architecture decided (sequencer timeline with shared clock).
- [x] unlock and fallback policy defined.
- [x] instrumentation and acceptance thresholds defined.
- [x] cadence schema and marker parser plan defined.
- [x] module/file plan defined with minimal diff intent.
