# Sharp Handoff Report: EnterPrompt Preview Runtime (Steps 3-7)

Date: 2026-02-16
Branch: `wire-preview-mount-graph`
Audience: next coding agent resuming preview-runtime work

## 1) Executive Summary
This branch now has bedrock support for mounting the real graph runtime in EnterPrompt preview, with strict sample-load validation, single-runtime lease safety, leak hardening, onboarding wheel allowlist for preview, and a new viewport contract scaffold.

Implemented and stabilized in this handoff window:
- Step 5: mount/unmount leak hardening
- Step 6: onboarding wheel guard allowlist for preview
- Step 7: graph viewport contract + runtime plumbing

Already present from prior runs and still active:
- Step 3: strict fail-closed sample JSON -> canonical restore pipeline
- Step 4: self-enforcing runtime lease (no zombie preview after preempt)

## 2) Current Runtime Truth

### 2.1 Preview runtime path
- `src/components/PromptCard.tsx` renders `<SampleGraphPreview />` in the former placeholder slot.
- `src/components/SampleGraphPreview.tsx` mounts the real runtime via `<GraphPhysicsPlayground />`.
- Preview applies:
  - portal scope container mode (`PortalScopeProvider`)
  - lease guard participation (`prompt-preview` owner)
  - strict sample-load validation gate
  - boxed viewport provider value (step 7 one-time snapshot)

### 2.2 Graph screen runtime path
- `src/screens/appshell/render/renderScreenContent.tsx`
  - wraps graph runtime subtree with:
    - `GraphViewportProvider value={defaultGraphViewport()}`
    - `GraphRuntimeLeaseBoundary owner="graph-screen"`
  - graph path behavior remains functionally unchanged.

## 3) What Was Implemented In This Session

## Step 5 (Leak Hardening)
Commits:
- `8864c1e` docs(leaks): inventory graph runtime mount/unmount resources (r1)
- `31f2bc1` fix(leaks): patch #1 graph runtime lifecycle leak (r2)
- `9670857` fix(leaks): patch #2 leak + add dev resource tracker counters (r3)
- `dc94bc8` fix(leaks): patch #3 leak + strictmode cleanup hardening (r4)
- `611f3e7` docs(runtime): document leak patches + add dev invariants (r5)

Key code outcomes:
1. `src/playground/rendering/graphRenderingLoop.ts`
- added missing cleanup for canvas wheel listener
- added missing cleanup for `document.fonts` loadingdone listener
- guarded `document.fonts.ready` callback against post-unmount execution
- added disposed guards to prevent zombie rAF re-scheduling during teardown races

2. `src/runtime/resourceTracker.ts`
- added dev-only resource counters and release guard
- added `warnIfGraphRuntimeResourcesUnbalanced(source)`

3. Boundary unmount invariant checks:
- `src/components/SampleGraphPreview.tsx`
- `src/runtime/GraphRuntimeLeaseBoundary.tsx`

Report files:
- `docs/report_2026_02_15_step5_leaks_r1.md`
- `docs/report_2026_02_15_step5_leaks_r2.md`
- `docs/report_2026_02_15_step5_leaks_r3.md`
- `docs/report_2026_02_15_step5_leaks_r4.md`
- `docs/report_2026_02_15_step5_leaks_r5.md`

## Step 6 (Onboarding Wheel Guard Conflict)
Commits:
- `14353a3` docs(step6): forensic wheel-guard conflict + gating plan (r1)
- `310b492` fix(step6): allow wheel events inside sample preview (r2)
- `045409e` chore(step6): harden wheel allowlist detection + dev counters (r3)
- `25633a0` fix(step6): stabilize preview root markers for wheel gating (r4)
- `f45fb9e` docs(step6): document wheel guard allowlist + verification (r5)

Key code outcomes:
1. `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- now allowlists wheel events inside preview roots and portal roots
- non-preview wheel behavior still blocked via `preventDefault`
- hardened target normalization for non-element event targets
- added minimal dev counters (allowed vs blocked)

2. `src/components/sampleGraphPreviewSeams.ts`
- centralized portal marker constants and helper
- now owns both:
  - preview root selector/helper
  - preview portal root selector/helper

3. `src/components/SampleGraphPreview.tsx`
- uses centralized portal marker constants (no hardcoded marker string)

Report files:
- `docs/report_2026_02_15_step6_wheel_guard_r1.md`
- `docs/report_2026_02_15_step6_wheel_guard_r2.md`
- `docs/report_2026_02_15_step6_wheel_guard_r3.md`
- `docs/report_2026_02_15_step6_wheel_guard_r4.md`
- `docs/report_2026_02_15_step6_wheel_guard_r5.md`

## Step 7 (Viewport Contract + Plumbing)
Commits:
- `bd19177` docs(step7): choose viewport provider seam + contract draft (r1)
- `e9198a3` feat(runtime): add graph viewport contract + provider + hook (r2)
- `0ab7f5d` feat(runtime): provide default window viewport to graph runtime subtree (r3)
- `f4b5fa3` feat(preview): provide boxed viewport contract value to preview runtime subtree (r4)
- `5f3affe` docs(step7): document viewport contract + invariants for boxed embed (r5)

Key code outcomes:
1. New module: `src/runtime/viewport/graphViewport.tsx`
- `GraphViewportMode`: `app | boxed`
- `GraphViewportSource`: `window | container | unknown`
- `GraphViewportRect`
- `GraphViewport`
- `defaultGraphViewport()`
- `GraphViewportProvider`
- `useGraphViewport()`
- `getGraphViewportDebugSnapshot(viewport)`

2. Graph screen runtime wiring:
- `src/screens/appshell/render/renderScreenContent.tsx`
- wraps runtime subtree with app-mode default viewport provider

3. Preview runtime wiring:
- `src/components/SampleGraphPreview.tsx`
- boxed viewport value now provided from one-time `getBoundingClientRect()` snapshot
- safe fallback viewport before rect is available (`1x1`, source unknown)

Report files:
- `docs/report_2026_02_15_step7_viewport_contract_r1.md`
- `docs/report_2026_02_15_step7_viewport_contract_r2.md`
- `docs/report_2026_02_15_step7_viewport_contract_r3.md`
- `docs/report_2026_02_15_step7_viewport_contract_r4.md`
- `docs/report_2026_02_15_step7_viewport_contract_r5.md`

## 4) Contracts You Must Preserve

1. Real runtime parity
- Preview must continue mounting the same graph runtime path as graph screen.
- No preview-only graph renderer.

2. Fail-closed sample loading
- Invalid sample payload must block runtime mount and show explicit error UI.

3. Lease ownership
- Single active runtime lease at a time.
- Graph-screen preempts prompt-preview.
- Lost token must unmount/stop preview runtime.

4. Portal containment in preview
- Preview overlays/tooltips remain container-scoped via portal scope seam.

5. Wheel ownership split
- Onboarding wheel guard blocks outside preview.
- Preview wheel area is allowlisted so graph wheel handler can own zoom/pan.

6. Cleanup balance
- Graph runtime resources must release on unmount; tracker warnings are regression signal.

7. Viewport contract separation
- Step 7 is plumbing only; do not assume all viewport consumers are migrated yet.

## 5) Known Deferred Work (Next Likely Steps)
Not done yet (intentionally deferred):
1. Step 8: live boxed viewport updates (ResizeObserver-driven provider updates)
2. Step 9: migrate viewport/clamp callsites from window/rect direct reads to `useGraphViewport()`
3. Any broader topology singleton refactor
4. Any non-leak perf retuning outside scoped work

## 6) Where To Start Next (Sharp Resume)

First read:
- `docs/system.md` sections:
  - Graph Runtime Lease Guard
  - Graph Runtime Cleanup Hardening
  - EnterPrompt Sample Graph Preview Mount
  - Graph Viewport Contract

Then inspect these seams in order:
1. `src/runtime/viewport/graphViewport.tsx`
2. `src/components/SampleGraphPreview.tsx`
3. `src/screens/appshell/render/renderScreenContent.tsx`
4. `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
5. `src/runtime/graphRuntimeLease.ts`
6. `src/runtime/resourceTracker.ts`
7. `src/playground/rendering/graphRenderingLoop.ts`

If you start step 8:
- replace preview one-time rect snapshot with ResizeObserver updates in `SampleGraphPreview.tsx`
- keep value-stable updates (avoid render loops)
- preserve fallback and lease/portal behavior

If you start step 9:
- migrate high-impact viewport reads first:
  - `renderLoopSurface.ts` dpr read
  - overlay clamp sites using `window.innerWidth/innerHeight`
- migrate incrementally with no behavior drift on graph-screen path

## 7) Build/Verification Status
- Build command used: `npm run build`
- Status: passed during each run in steps 5-7.
- Existing known warnings (unchanged):
  - dynamic + static import warning for `GraphPhysicsPlayground`
  - large chunk size warning

## 8) Current Worktree Context
Unrelated local changes still present and intentionally untouched:
- modified: `src/screens/AppShell.tsx`
- untracked: `docs/merged_report.md`
- untracked: `docs/report_2026_02_15_preview_step3_step4_handoff_detailed.md`

Do not revert these unless explicitly instructed.

## 9) Single-Page Resume Statement
Preview runtime is now production-shaped: canonical data gate, lease-safe lifecycle, leak-hardened teardown, wheel allowlist in onboarding, and viewport contract plumbing are all in place. Next agent should execute step 8 (live boxed viewport updates) and then step 9 (consumer migration to viewport contract) while preserving all contracts above.
