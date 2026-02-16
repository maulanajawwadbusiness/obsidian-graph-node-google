# Sharp Resume Handoff: All Work So Far

Date: 2026-02-16
Audience: next agent resuming from current branch state
Branch baseline: `wire-preview-mount-graph`

## 1) Executive Snapshot

Major completed streams in this branch:
1. Graph loading gate bedrock and error-flow hardening (latest commits include run-level gate error contract work).
2. Step 8 viewport origin + live measurement hardening.
3. Step 9 boxed viewport clamp/origin consumer migration and cleanup.
4. Step 8 hardening round 2 (movement/interaction stabilization and settle safety).

Prepared next stream:
5. Step 10 boxed input ownership plan (pointer + wheel + overlay ownership) documented and ready.

## 2) High-Value Commit Timeline (Recent)

Latest relevant commits:
- `a454210` docs(hardening): lock explicit gate error visibility contract
- `d5b2267` fix(flow): normalize gate error message handoff to prompt
- `ceaaf7c` feat(gate): render explicit error and stalled gate states
- `71a368a` refactor(appshell): remove auto redirect from gate error phase
- `73dbf74` docs(step8): document hardened triggers + add dev counters + final audit (r5)
- `b3a2c7e` chore(step8): strictmode/ref-swap hardening + listener hygiene + tracker balance (r4)
- `2fbf215` chore(step8): mount stabilization burst + visibility-safe settle loop (r3)
- `d9bcdab` fix(step8): refresh viewport origin on user interaction (pointer/wheel) with throttling (r2)
- `afd06f4` docs(step8): hardening2 plan (interaction refresh + mount stabilization + visibility guard) (r1)
- `7fd73b3` docs(step8/9): document movement-aware viewport + finalize boxed clamp audit (r4)
- `d298252` chore(step8): strictmode/ref-swap hardening + patch step9 boxed clamp leftovers (r3)
- `298de45` fix(step8): refresh viewport origin on movement with bounded settle raf (r2)
- `f1c723c` docs: map movement trigger gap and step9 boxed audit suspects (r1)
- `41ecdac` docs(step8): document viewport origin source + final origin fix audit (r7-r8)
- `5e9ed81` chore(step8): add dev sanity checks + verify tracker balance for viewport observer (r5-r6)
- `fef4cad` chore(step8): harden ResizeObserver viewport sizing + strictmode safety (r3-r4)
- `cedebe1` fix(step8): derive viewport origin from getBoundingClientRect (r1-r2)

## 3) What Is True Now (System Contracts)

## 3.1 Step 8 viewport contract (current truth)
Primary file:
- `src/runtime/viewport/useResizeObserverViewport.ts`

Contract:
1. Origin source is BCR (`getBoundingClientRect().left/top`), not `contentRect.left/top`.
2. Size source preference:
   - `contentBoxSize` when available
   - fallback `contentRect.width/height`
   - fallback BCR width/height
3. Movement refresh triggers:
   - window `scroll`/`resize`
   - visualViewport `scroll`/`resize`
   - target interaction (`pointerenter`, throttled `pointermove`, `wheel`)
4. Bounded settle:
   - stable-frame settling with hard cap
   - visibility-safe (stop settle while hidden)
   - no permanent polling
5. Cleanup and strictmode safety:
   - listener removal + observer disconnect + rAF cancellation
   - tracker lifecycle preserved

## 3.2 Step 9 boxed consumer truth
Consumers migrated and hardened:
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `src/runtime/viewport/viewportMath.ts`

Contract:
1. Boxed local conversion uses viewport origin.
2. Boxed clamp uses viewport dimensions.
3. Remaining concrete bug (`MiniChatbar` below placement using client-space left) was fixed.
4. Warn-once fallback for missing boxed bounds remains in `viewportMath`.

## 3.3 Docs synchronized
`docs/system.md` already contains:
1. Step 8 movement-aware viewport semantics and tracker naming.
2. Step 9 boxed clamp/origin rules and verification checklist.

## 4) Generated Reports (Key Reading Order)

Read in this sequence:
1. `docs/report_2026_02_16_step8_step9_handoff_detailed.md`
2. `docs/report_2026_02_16_step8_origin_fix_r1.md` ... `r8.md`
3. `docs/report_2026_02_16_step8_move_step9_audit_r1.md` ... `r4.md`
4. `docs/report_2026_02_16_step8_hardening2_r1.md` ... `r5.md`
5. `docs/report_2026_02_16_graph_loading_error_bedrock_run1.md` ... `run5.md`
6. `docs/report_2026_02_16_step10_boxed_input_plan.md`

## 5) Known Risks / Active Edges

1. Concurrent worktree edits can appear at any time (repo policy allows this).
2. Build can fail due to unrelated files outside active scope; this happened during prior runs and was documented.
3. Step 10 (boxed input ownership) is not yet implemented in code; plan is ready.

## 6) Exact Next Start (for next agent)

If resuming Step 10:
1. Read:
   - `docs/report_2026_02_16_step10_boxed_input_plan.md`
   - `src/components/SampleGraphPreview.tsx`
   - `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
   - `src/ui/tooltip/TooltipProvider.tsx`
   - `src/popup/NodePopup.tsx`
   - `src/popup/MiniChatbar.tsx`
   - `src/popup/ChatShortageNotif.tsx`
   - `src/components/sampleGraphPreviewSeams.ts`
2. Implement run-by-run from the Step 10 plan with report/build/commit cadence.
3. Keep app-mode behavior unchanged; boxed preview only.

## 7) Non-Negotiable Invariants To Preserve

1. No `contentRect.left/top` origin usage in viewport logic.
2. No permanent frame loop introduced for viewport refresh.
3. Overlay input shielding must prevent canvas-under-overlay reactions.
4. Onboarding wheel guard behavior outside preview must stay unchanged.
5. Strict cleanup and tracker balance must remain intact.

## 8) Quick Resume Statement

Viewport and boxed clamp foundations are bedrocked (Steps 8/9 complete with hardening).  
Graph loading error gate flow is hardened in latest commits.  
Step 10 boxed input ownership is planned and should be implemented next exactly per `docs/report_2026_02_16_step10_boxed_input_plan.md`.

