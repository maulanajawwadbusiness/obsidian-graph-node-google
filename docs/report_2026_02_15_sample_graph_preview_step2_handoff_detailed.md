# Detailed Handoff Report: EnterPrompt Sample Graph Preview (Step 1 + Step 2)

Date: 2026-02-15
Branch Context: `wire-preview-mount-graph`
Primary Goal: Mount the real graph runtime into EnterPrompt sample preview slot without introducing a preview-only graph implementation.

## 1) Executive Summary
This work completed two major phases:

1. Step 1 forensic mapping (replacement seam discovery and risk inventory)
2. Step 2 implementation (wrapper mount + PromptCard seam swap + sizing hardening + seam prep + docs)

The preview box on EnterPrompt now mounts the real runtime path via `GraphPhysicsPlayground` through `SampleGraphPreview`, replacing the old text placeholder node while preserving the existing outer wrapper geometry.

What is intentionally not fixed yet:
- wheel guard gating for preview ownership,
- portal root scoping for boxed containment,
- render-loop cleanup gaps (`canvas.wheel`, `document.fonts` listener teardown).

## 2) Completed Deliverables

### 2.1 Forensic reports (Step 1)
Created:
- `docs/report_2026_02_15_preview_box_replacement_point_r1.md`
- `docs/report_2026_02_15_preview_box_replacement_point_r2.md`
- `docs/report_2026_02_15_preview_box_replacement_point_r3.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect_v2.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect_v3.md`

### 2.2 Implementation reports (Step 2)
Created:
- `docs/report_2026_02_15_sample_graph_preview_impl_r1.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r2.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r3.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r4.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r5.md`

### 2.3 Code changes (Step 2)
Added:
- `src/components/SampleGraphPreview.tsx`
- `src/components/sampleGraphPreviewSeams.ts`

Updated:
- `src/components/PromptCard.tsx`
- `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- `src/popup/PopupOverlayContainer.tsx`
- `docs/system.md`

## 3) Exact Seams and Current Runtime Wiring

### 3.1 Prompt slot seam (now active)
- `src/components/PromptCard.tsx:88-90`

Current JSX:
```tsx
<div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
    <SampleGraphPreview />
</div>
```

Preserved layout contract:
- wrapper style token unchanged: `src/components/PromptCard.tsx:273` (`GRAPH_PREVIEW_PLACEHOLDER_STYLE`)
- geometry remains 200px box with same border/radius/bg.

### 3.2 Preview runtime component
- `src/components/SampleGraphPreview.tsx`

Key behavior:
- root marker: `data-arnvoid-graph-preview-root="1"` via shared seam constants
- wrapper styles:
  - `position: relative`
  - `width: 100%`
  - `height: 100%`
  - `overflow: hidden`
  - `borderRadius: inherit`
- full-fill surface div (`position: absolute; inset: 0`) hosts runtime
- mounts real runtime entrypoint:
```tsx
<GraphPhysicsPlayground
  pendingAnalysisPayload={null}
  onPendingAnalysisConsumed={() => {}}
  enableDebugSidebar={false}
/>
```
- local error boundary fallback text: `sample graph initializing...`

### 3.3 Preview seam helper module
- `src/components/sampleGraphPreviewSeams.ts`

Exports:
- `SAMPLE_GRAPH_PREVIEW_ROOT_ATTR`
- `SAMPLE_GRAPH_PREVIEW_ROOT_VALUE`
- `SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR`
- `isInsideSampleGraphPreviewRoot(target)`

Purpose:
- future wheel guard target detection
- future portal scoping seam references

## 4) Commits for Step 2
Core step-2 commit chain:
- `fc22cc5` feat(preview): add SampleGraphPreview wrapper component (r1)
- `1e645bd` feat(promptcard): mount SampleGraphPreview in placeholder slot (r2)
- `5c3f244` fix(preview): enforce container-relative sizing + clip (r3)
- `d59e4b3` chore(preview): add preview root markers + future seam notes (r4)
- `36824ba` docs(preview): document sample graph preview mount + risks (r5)

Forensic seam confirmation chain (earlier):
- `77f8f11` docs(report): locate sample graph preview placeholder (r1)
- `cbc9589` docs(report): confirm unique preview placeholder + variants (r2)
- `a535085` docs(report): define preview box replacement seam (r3)

## 5) Build and Validation Status
During step-2 runs, `npm run build` passed after each run.

Notable build-time warnings (known):
1. `GraphPhysicsPlayground` now both dynamic (AppShell lazy import) and static (SampleGraphPreview import); Vite warns this prevents chunk split for that module.
2. Large chunk warnings remain (`>500 kB`).

No TypeScript errors remain from this step-2 work.

## 6) Known Risks and Deferred Work (Critical)

### 6.1 Wheel guard conflict
- `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:16-20`
- window capture listener currently calls `preventDefault()` for active onboarding.
- Impact: preview wheel zoom may be blocked.
- Prep done: TODO comment and preview root seam helper are in place.

### 6.2 Portal escape from preview box
Current portal-to-body surfaces include:
- login overlay,
- tooltip provider,
- popup overlay container,
- AI activity glyph.

Impact:
- true boxed containment is not guaranteed yet.

Prep done:
- TODO seam note added in `src/popup/PopupOverlayContainer.tsx:31-33`.

### 6.3 Overlay masking on prompt
- EnterPrompt drag/error/login overlays are fixed and can mask preview input/visibility.
- This is expected current behavior and not changed in step 2.

### 6.4 Render-loop listener cleanup gaps (existing)
From prior forensic scan:
- missing `removeEventListener` for canvas wheel in graph loop cleanup,
- missing remove for `document.fonts.loadingdone` listener.

Impact:
- repeated mount/unmount can leak listeners.
- not fixed in step 2 by design.

## 7) What Next Agent Should Do (Step 3+)

Priority order:
1. Canonical sample JSON load path
- adapt dev export JSON into `SavedInterfaceRecordV1`
- validate via `parseSavedInterfaceRecord`
- feed through `pendingLoadInterface` path (no preview-only format)

2. Wheel guard gating
- use `isInsideSampleGraphPreviewRoot(event.target)` to allow wheel ownership by preview runtime
- keep existing onboarding behavior outside preview root

3. Portal scoping
- add optional portal root target on popup/tooltip/glyph layers
- route preview instance portals to container-scoped root

4. Cleanup hygiene
- patch render-loop teardown for canvas wheel and `document.fonts` listener
- verify by repeated mount/unmount cycle

5. Containment verification
- ensure popups/tooltips/chat surfaces stay inside preview box once scoped

## 8) Manual Verification Checklist (Current + Next)
Current step-2 checks:
1. Prompt screen renders without crash.
2. Placeholder label replaced by runtime surface.
3. Preview stays inside 200px box.
4. Build passes.

Next-step checks:
1. Wheel over preview zooms graph and does not leak page scroll.
2. Popup/chat/tooltip stay container-scoped in preview mode.
3. Re-enter prompt repeatedly without listener accumulation.
4. Transition prompt -> graph has no cross-talk.

## 9) Non-Negotiable Invariants to Preserve
1. No preview-only graph runtime path.
2. Prompt slot wrapper geometry must remain stable unless explicitly redesigning UI.
3. Future sample JSON must use canonical saved-interface contract path.
4. Input shielding doctrine remains: overlays own pointer/wheel when active.

## 10) Quick File Map for Continuation
- Preview mount component: `src/components/SampleGraphPreview.tsx`
- Preview seam helper: `src/components/sampleGraphPreviewSeams.ts`
- Prompt seam host: `src/components/PromptCard.tsx`
- Wheel guard seam: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- Popup portal seam: `src/popup/PopupOverlayContainer.tsx`
- Runtime entrypoint: `src/playground/GraphPhysicsPlayground.tsx`
- Runtime prop contract: `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Canonical saved interface type/parser: `src/store/savedInterfacesStore.ts`

## 11) Additional Branch Context (Do Not Assume Ownership)
There are newer commits on this branch beyond preview step-2 work (flow/graph-loading and route tests). They may affect startup flow and graph mount timing:
- `0ed0c29`, `3dd968b`, `f98f624`, `e0ce77a`, `6ad5ca4`, `bd349d6`, `386590d`, `6a66c4f`, `df14b61`, etc.

Next agent should read those diffs before changing prompt->graph transition behavior.

---
End of handoff report.
