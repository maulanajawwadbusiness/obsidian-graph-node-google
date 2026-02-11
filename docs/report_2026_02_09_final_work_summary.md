# Final Report: Parsing/Input Wiring and Graph Visibility Debug
Date: 2026-02-09

## Scope Summary
This report consolidates all work completed today for:
- EnterPrompt text input wiring
- Dev-mode analysis execution path
- Graph visibility failure investigation
- Render loop remount lifecycle fixes

No secrets were added to repo files.

## 1) Grounding and Forensic Read
Read and traced these docs first:
- `docs/system.md`
- `docs/repo_xray.md`
- `docs/report_2026_02_09_enterprompt_text_to_analyzer_forensic.md`

Then traced live code paths for:
- EnterPrompt input -> AppShell pending payload -> Graph consume
- Analyzer call chain (`paperAnalyzer` -> `nodeBinding` -> topology/engine rewiring)
- Loading/graph swap behavior in `GraphPhysicsPlayground`

## 2) EnterPrompt Parsing/Input Work
### Implemented
1. `src/components/PromptCard.tsx`
- Added submit guard for empty/whitespace input.
- Submit now sends trimmed text.

2. `src/screens/EnterPrompt.tsx`
- Added trimmed-text submit guard.
- Keeps existing submit handoff and screen transition behavior.

### Result
- Enter submits clean text only.
- Shift+Enter behavior preserved.
- Empty input no longer triggers analysis flow.

## 3) Dev Direct OpenAI Analyzer Path
### Problem addressed
In dev onboarding flow, backend analyzer endpoint is auth-gated, causing friction/dead-end for local paste-to-map testing.

### Implemented
File: `src/ai/paperAnalyzer.ts`
- Added dev-only direct OpenAI analyzer path, enabled when:
  - `import.meta.env.DEV` and
  - `VITE_OPENAI_API_KEY` exists
- Direct path uses existing frontend LLM client:
  - `createLLMClient(... mode: 'openai')`
  - `generateStructured(...)`
- Added local analyze schema + strict parser for:
  - `paper_title`
  - `main_points`
  - `links`
- Preserved strict failure policy (no local fallback).
- Kept non-dev and no-key behavior unchanged (existing backend route).

### Result
- In dev, pasted text can run analyzer directly from frontend key path.
- Existing node binding/topology pipeline remains unchanged.

## 4) Reports Added During Work
Created:
- `docs/report_2026_02_09_enterprompt_dev_direct_openai.md`
- `docs/report_2026_02_09_renderloop_remount_fix.md`
- `docs/report_2026_02_09_renderloop_canvas_ready_fix.md`

## 5) Graph Invisible But Interactive Incident
### User symptom
- Analysis succeeds.
- Graph appears empty.
- Pointer grab/popup works.

### Diagnostic findings
From live checks:
- Engine has nodes/links.
- Canvas CSS size and backing store initially mismatched.
- Crucial check: `graph-render-tick` count returned `0` after analysis completion.

### Meaning
- Data and interaction paths are alive.
- Render loop was not running/restarted after loading-state unmount.

## 6) Render Loop Lifecycle Fixes
### First lifecycle patch
- Added loop lifecycle logs in `useGraphRendering`.
- Added first-frame log in `graphRenderingLoop`.
- Added loading-exit remount log in `GraphPhysicsPlayground`.

Observed logs showed:
- `[RenderLoop] stop`
- `[RenderLoop] skipped missing canvas`
- `[Graph] loading_exit_remount_canvas`
- but no `[RenderLoop] start`

This revealed stale ref capture behavior.

### Final lifecycle patch (root fix)
1. `src/playground/GraphPhysicsPlayground.tsx`
- Added callback ref for canvas mount state.
- Added `canvasReady` state.
- Canvas now uses callback ref.
- Passed `canvasReady` to rendering hook.

2. `src/playground/useGraphRendering.ts`
- Added `canvasReady` prop.
- Effect now gates on `canvasReady` + live refs.
- Removed stale captured `canvasRef.current` dependency pattern.
- Updated ref prop types to mutable refs.

### Result target
After loading exits, expected log sequence:
1. `[Graph] loading_exit_remount_canvas`
2. `[RenderLoop] start canvas=...`
3. `[RenderLoop] first_frame`

## 7) Validation
Build validations run multiple times after changes:
- `npm run build` passed at end.

Known non-blocking build warnings remain pre-existing (chunk size and font resolve notes).

## 8) Files Changed Today (Net)
- `src/ai/paperAnalyzer.ts`
- `src/components/PromptCard.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/playground/useGraphRendering.ts`
- `src/playground/rendering/graphRenderingLoop.ts`
- `src/playground/GraphPhysicsPlayground.tsx`

Plus reports listed above.

## 9) Current State
- Dev paste-to-analyze path is implemented.
- Input submit guards are implemented.
- Render loop remount lifecycle fix is implemented and build-clean.
- Final runtime confirmation should be done by checking post-analysis logs and graph visibility in browser session.
