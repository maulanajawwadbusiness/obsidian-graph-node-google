# Detailed Handoff Report: Preview Runtime Step 8 + Step 9

Date: 2026-02-16
Branch: wire-preview-mount-graph
Authoring scope: this report captures the work I completed for Step 8 and Step 9, including implementation decisions, changed seams, validation status, and exact next-start guidance.

---

## 1) Executive Summary

Completed in this handoff window:

1. Step 8: live viewport measurement bedrock
- Added reusable ResizeObserver + rAF batched viewport hook.
- Wired live viewport updates into both runtime roots:
  - graph screen pane (app mode)
  - sample preview container (boxed mode)
- Added cleanup safety and tracker integration.

2. Step 9: boxed viewport consumption (purge window-sized assumptions from boxed runtime path)
- Replaced boxed overlay clamp/origin math to consume `GraphViewport` contract.
- Updated these visible systems first:
  - tooltip positioning/clamp
  - node popup positioning/clamp
  - mini chatbar positioning/clamp
  - chat shortage notification clamp
- App mode behavior preserved via fallback paths.

Build status:
- `npm run build` passed for every run.

---

## 2) Commit Map

### Step 8 commits
1. `026b9da`
- `docs(step8): plan resize observer viewport hook + replacement seams (r1)`

2. `073e882`
- `feat(viewport): add ResizeObserver-based viewport hook with raf batching (r2)`

3. `a390983`
- `feat(preview): use live ResizeObserver viewport for boxed sample preview (r3)`

4. `d4ff89c`
- `feat(graph): use live ResizeObserver viewport for graph pane provider (r4)`

5. `2bb21b5`
- `docs(step8): document live viewport measurement + dev invariants (r5)`

### Step 9 commits
6. `7183207`
- `docs(step9): migration map of window-sized assumptions for boxed mode (r1)`

7. `f900c72`
- `fix(boxed): use GraphViewport for clamp + pointer coords instead of window in preview (r2)`

8. `9753aff`
- `docs(boxed): document viewport-based clamp + add dev invariants (r3)`

---

## 3) Files Added / Removed / Updated

### Added
- `src/runtime/viewport/useResizeObserverViewport.ts`
- `src/runtime/viewport/viewportMath.ts`
- `docs/report_2026_02_16_step8_resize_observer_r1.md`
- `docs/report_2026_02_16_step8_resize_observer_r2.md`
- `docs/report_2026_02_16_step8_resize_observer_r3.md`
- `docs/report_2026_02_16_step8_resize_observer_r4.md`
- `docs/report_2026_02_16_step8_resize_observer_r5.md`
- `docs/report_2026_02_16_step9_boxed_viewport_r1.md`
- `docs/report_2026_02_16_step9_boxed_viewport_r2.md`
- `docs/report_2026_02_16_step9_boxed_viewport_r3.md`

### Removed
- `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`

### Updated
- `src/components/SampleGraphPreview.tsx`
- `src/screens/appshell/render/GraphScreenShell.tsx`
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `docs/system.md`
- `src/runtime/resourceTracker.ts` (from preceding hardening that this step builds on)

---

## 4) Step 8 Details (Live Measurement Contract Feed)

### 4.1 New hook
File: `src/runtime/viewport/useResizeObserverViewport.ts`

Behavior:
1. Observes container with `ResizeObserver`.
2. Stores latest rect in a ref.
3. Coalesces updates through a single pending `requestAnimationFrame`.
4. Emits viewport with:
- `width`, `height`: `floor` and clamp `>= 1`
- `boundsRect`: rect left/top + clamped width/height
- `dpr`: normalized from `window.devicePixelRatio`
- `mode` + `source` from caller options
5. Applies shallow equality before state update to avoid churn.
6. Cleanup:
- cancel pending rAF
- disconnect observer
- disposed guard prevents post-unmount updates
7. DEV tracker integration:
- `graph-runtime.viewport.resize-observer`
- `graph-runtime.viewport.resize-raf`

### 4.2 Wiring: preview
File: `src/components/SampleGraphPreview.tsx`

Change:
- Replaced one-shot `useLayoutEffect` snapshot logic with live hook:
- `useResizeObserverViewport(previewRootRef, { mode: 'boxed', source: 'container', fallbackViewport })`

Preserved:
- lease guard behavior
- portal scope behavior
- validation pipeline behavior

### 4.3 Wiring: graph screen
File: `src/screens/appshell/render/GraphScreenShell.tsx`

Change:
- Replaced `useGraphPaneViewportSnapshot` with live hook on `graphPaneRef`.
- Provider remains in `GraphScreenShell`, so scope still includes runtime + `GraphLoadingGate`.

### 4.4 Provider ownership / placement
- `GraphViewportProvider` remains owned by `GraphScreenShell` for graph screen.
- `SampleGraphPreview` still owns its boxed provider locally.

---

## 5) Step 9 Details (Boxed Viewport Consumption)

## 5.1 Migration strategy
- Do not refactor everything.
- Patch the highest-visibility boxed screen-space systems first.
- Keep app mode path behavior unchanged unless trivially equivalent.

### 5.2 New shared math seam
File: `src/runtime/viewport/viewportMath.ts`

Functions:
- `isBoxedViewport(viewport)`
- `getViewportSize(viewport, fallbackW, fallbackH)`
- `getViewportOrigin(viewport)`
- `toViewportLocalPoint(clientX, clientY, viewport)`
- `clampToViewport(value, contentSize, viewportSize, margin)`

DEV instrumentation:
- counters:
  - `boxedClampCalls`
  - `boxedPointerNormCalls`
  - `boxedTooltipClampCalls`
- helper:
  - `getBoxedViewportDebugCounters()`
- warn-once if boxed viewport has null bounds:
  - `[ViewportMath] boxed viewport missing boundsRect; using origin 0,0 fallback`

### 5.3 Patched consumers

1. `src/ui/tooltip/TooltipProvider.tsx`
- Injected `useGraphViewport()`.
- In boxed mode:
  - anchor local conversion uses viewport bounds origin.
  - clamp uses viewport width/height.
- App/container path remains fallback compatible.

2. `src/popup/NodePopup.tsx`
- Injected `useGraphViewport()`.
- `computePopupPosition` now accepts viewport and uses boxed conversion/clamp from viewport contract.
- Initial fallback height in boxed mode now derives from viewport size, not raw window.

3. `src/popup/MiniChatbar.tsx`
- Injected `useGraphViewport()`.
- Local popup rect conversion in boxed mode now uses viewport origin.
- Clamp extents in boxed mode now use viewport width/height.
- Fixed naming collision during implementation (`viewport` -> `viewportW`).

4. `src/popup/ChatShortageNotif.tsx`
- Injected `useGraphViewport()`.
- In boxed mode, local anchor conversion + clamp extents use viewport contract.

### 5.4 Explicitly not changed (by design)
- Camera containment algorithm (already rect-based through canvas dimensions).
- Core pointer->world conversion in render/camera path (already rect-origin based).

---

## 6) Docs Updated

File: `docs/system.md`

Updated sections:
1. Step 8 truth in viewport contract area:
- live ResizeObserver measurement now active
- rAF batching + cleanup semantics documented

2. Added Step 9 section:
- `2.11 Boxed Viewport Consumption (Step 9, 2026-02-16)`
- changed subsystem list
- boxed vs app behavior rules
- dev counters/warn-once invariant
- manual verification checklist

---

## 7) Validation Performed

For each run (Step 8 r1-r5 and Step 9 r1-r3):
- ran `npm run build`
- all builds passed

Known existing warnings (unchanged):
- dynamic+static import warning for `GraphPhysicsPlayground`
- chunk size warnings

---

## 8) Contract State After This Work

### Must-hold invariants now
1. Preview and graph screen both receive live viewport values.
2. Boxed mode overlay clamps/origin conversion use viewport contract.
3. App mode behavior for these systems remains fallback-compatible and unchanged by intent.
4. Resize observer resources are tracked and cleaned.

### Deferred work (not done here)
1. Broader consumer migration beyond patched systems (if needed).
2. Any app-mode unification where window fallbacks can be safely eliminated.
3. Step 10+ workstreams (input ownership refinements and boxed UI rules) from your roadmap.

---

## 9) Sharp Resume Checklist for Next Agent

Start with these files in order:
1. `src/runtime/viewport/useResizeObserverViewport.ts`
2. `src/runtime/viewport/viewportMath.ts`
3. `src/components/SampleGraphPreview.tsx`
4. `src/screens/appshell/render/GraphScreenShell.tsx`
5. `src/ui/tooltip/TooltipProvider.tsx`
6. `src/popup/NodePopup.tsx`
7. `src/popup/MiniChatbar.tsx`
8. `src/popup/ChatShortageNotif.tsx`
9. `docs/system.md` (sections 2.10 and 2.11)

If continuing step-9+ hardening:
1. Verify app-mode parity manually around tooltip/popup behavior on graph screen.
2. Check whether any additional overlay components still use window bounds in boxed path.
3. Keep boxed gating explicit (`viewport.mode === 'boxed'`) until app-mode unification is intentionally approved.

---

## 10) Current Worktree Context

Unrelated local modification still present and intentionally untouched:
- `src/screens/AppShell.tsx`

No other uncommitted tracked changes from this work remain.
