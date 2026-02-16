# Detailed Handoff Report: EnterPrompt Preview Runtime Work (Step 2 + Step 3 + Transition Context)

Date: 2026-02-15  
Branch: `wire-preview-mount-graph`  
Purpose: future-agent resume document with exact current truth, commit chain, seams, risks, and next actions.

## 1. Executive Summary

Preview on EnterPrompt now mounts the real graph runtime path and loads deterministic sample graph data through the canonical restore contract.

Completed major tracks:
1. Step 2: real runtime mount in preview slot (no preview-only renderer)
2. Step 2.5: portal/overlay containment seam for preview container mode
3. Step 3: dev-export sample JSON adapter -> canonical parser -> pending restore path

Not completed in this workstream:
1. wheel guard target-aware gating
2. render-loop listener cleanup gaps
3. topology singleton refactor
4. perf tuning
5. single-active-runtime lease guard (step 4 requested later but not implemented here)

## 2. Current Behavior Snapshot

### 2.1 Preview runtime mount
- `src/components/PromptCard.tsx` renders `<SampleGraphPreview />` inside the existing `GRAPH_PREVIEW_PLACEHOLDER_STYLE` wrapper.
- `src/components/SampleGraphPreview.tsx` mounts `GraphPhysicsPlayground` (real runtime path).

### 2.2 Containment
- Preview has a container-scoped portal root and portal scope provider:
  - `src/components/portalScope/PortalScopeContext.tsx`
  - `PortalScopeProvider mode="container"` used in preview only
- Graph screen remains app mode default (portal root `document.body`).

### 2.3 Data path (canonical)
- Preview sample file:
  - `src/samples/sampleGraphPreview.export.json`
- Adapter:
  - `src/lib/devExport/devExportTypes.ts`
  - `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
- Validation and restore wiring in preview:
  - `parseDevInterfaceExportV1(...)`
  - `devExportToSavedInterfaceRecordV1(...)`
  - `parseSavedInterfaceRecord(...)`
  - pass as `pendingLoadInterface` to `GraphPhysicsPlayground`

### 2.4 Restore entrypoint contract
- `pendingLoadInterface` type and restore consume path live in:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Default spawn is skipped when pending restore intent exists at init.

## 3. Commit Timeline (Most Relevant)

### Step 2 baseline
- `fc22cc5` feat(preview): add SampleGraphPreview wrapper component (r1)
- `1e645bd` feat(promptcard): mount SampleGraphPreview in placeholder slot (r2)
- `5c3f244` fix(preview): enforce container-relative sizing + clip (r3)
- `d59e4b3` chore(preview): add preview root markers + future seam notes (r4)
- `36824ba` docs(preview): document sample graph preview mount + risks (r5)

### Step 2.5 containment
- `270ddcd` chore(portal-scope): add portal scope context skeleton (r1)
- `c1a2616` refactor(portals): route portals through portal scope root (r2)
- `e67bfd9` fix(preview-portals): container-scope portal overlays in container mode (r3)
- `e99dc5a` fix(preview-portals): clamp popup/tooltip coords to portal bounds in container mode (r4)
- `f181462` feat(preview): container-scope portals/overlays for SampleGraphPreview (r5)

### Step 3 sample adapter and canonical restore
- `2bf6a7a` docs(report): map canonical restore contract for sample preview (r1)
- `281ad30` feat(preview-data): add devExport->SavedInterfaceRecord adapter (r2)
- `26199c0` feat(preview): load sample graph via canonical restore pipeline (r3)
- `ff2ece6` fix(preview): stabilize sample load + prevent persistence side effects (r4)
- `016eab3` docs(preview): document sample json restore pipeline for preview (r5)

## 4. Files Added/Changed by Preview Work

### Core preview runtime and data
- `src/components/SampleGraphPreview.tsx`
- `src/components/sampleGraphPreviewSeams.ts`
- `src/samples/sampleGraphPreview.export.json`
- `src/lib/devExport/devExportTypes.ts`
- `src/lib/devExport/devExportToSavedInterfaceRecord.ts`

### Portal scope and containment
- `src/components/portalScope/PortalScopeContext.tsx`
- `src/popup/PopupOverlayContainer.tsx`
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/playground/components/AIActivityGlyph.tsx`
- `src/auth/LoginOverlay.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `src/playground/components/CanvasOverlays.tsx`

### Prompt mount seam
- `src/components/PromptCard.tsx`

### Documentation
- `docs/system.md`
- `docs/report_2026_02_15_preview_box_replacement_point_r1.md`
- `docs/report_2026_02_15_preview_box_replacement_point_r2.md`
- `docs/report_2026_02_15_preview_box_replacement_point_r3.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect_v2.md`
- `docs/report_2026_02_15_sample_graph_preview_scandissect_v3.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r1.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r2.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r3.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r4.md`
- `docs/report_2026_02_15_sample_graph_preview_impl_r5.md`
- `docs/report_2026_02_15_sample_graph_preview_step2_handoff_detailed.md`
- `docs/report_2026_02_15_preview_portal_scope_r1.md`
- `docs/report_2026_02_15_preview_portal_scope_r2.md`
- `docs/report_2026_02_15_preview_portal_scope_r3.md`
- `docs/report_2026_02_15_preview_portal_scope_r4.md`
- `docs/report_2026_02_15_preview_portal_scope_r5.md`
- `docs/report_2026_02_15_sample_preview_adapter_r1.md`
- `docs/report_2026_02_15_sample_preview_adapter_r2.md`
- `docs/report_2026_02_15_sample_preview_adapter_r3.md`
- `docs/report_2026_02_15_sample_preview_adapter_r4.md`
- `docs/report_2026_02_15_sample_preview_adapter_r5.md`

## 5. Canonical Contracts (Do Not Break)

### 5.1 Restore payload parse contract
- `parseSavedInterfaceRecord(...)` returns nullable record and must remain canonical validation entry.
- Type owner: `SavedInterfaceRecordV1` in `src/store/savedInterfacesStore.ts`.

### 5.2 Runtime restore path contract
- Preview must feed `pendingLoadInterface` only.
- Do not create a second restore path for preview.

### 5.3 No write side effects in preview
- Preview path must remain in-memory.
- No saved-interface upsert/layout patch callbacks should be wired from preview.

### 5.4 Containment contract
- In preview container mode, overlays/tooltips/popups must stay inside preview box.
- App mode behavior for graph screen must remain unchanged.

## 6. Known Open Risks

1. Wheel guard conflict remains:
   - `src/screens/appshell/transitions/useOnboardingWheelGuard.ts` can still block wheel in preview area.
2. Graph runtime cleanup gaps remain (not fixed here):
   - previously identified canvas wheel/document.fonts listener teardown risks.
3. Runtime overlap hard guard not implemented yet:
   - no global lease primitive currently enforcing single active graph runtime owner.

## 7. Transition/Flow Context Not Owned by This Preview Work

Recent branch commits include graph-loading flow/gate work that may affect mount timing:
- `59321b3`
- `982a19b`
- `9cf383d`
- `5422ffd`
- `66e00a7`
- `3fe1a33`

Future agent must read these diffs before implementing lifecycle lease guard to avoid conflicting assumptions about prompt/graph-loading/graph mount order.

## 8. Current Working Tree Note

Unrelated local modifications currently visible:
- `AGENTS.md`
- `src/i18n/strings.ts`

These were not changed by this preview work and should be treated as out-of-scope unless explicitly requested.

## 9. Build Verification State

`npm run build` passed after each run in step 2, step 2.5, and step 3.

Current recurring build warnings (known):
1. static + dynamic import of `GraphPhysicsPlayground` affects chunk splitting.
2. large chunk warnings from Vite.

## 10. Recommended Next Agent Resume Order

If resuming with step 4 (single active runtime lease guard):
1. Re-read:
   - `src/components/SampleGraphPreview.tsx`
   - `src/playground/GraphPhysicsPlaygroundShell.tsx`
   - graph-loading flow commits listed in section 7
2. Implement a tiny deterministic lease primitive (global module) with graph-screen priority.
3. Wire acquire/release in preview and graph-screen mount points.
4. Block preview mount if lease denied.
5. Add dev instrumentation for acquire/deny/release/preempt.
6. Update docs and verification checklist.

Do not combine step 4 with wheel guard or cleanup refactors in one pass.

---
End of report.
