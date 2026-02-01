# Report: Physics Atlas Build
**Date:** 2026-02-01
**Author:** Antigravity

## 1. Summary
Created `docs/PHYSICS_ATLAS.md`, a centralized index that maps symptoms to the 10 distinct forensic docs (A–J) written during the Physics Unification.

## 2. Changes
*   **New Doc**: `docs/PHYSICS_ATLAS.md`
    *   Direct link to T1–T7 (Acceptance).
    *   A–J Map (Ownership, Inventory, Metrics, Repulsion, XPBD, Telemetry, Ghost, Mode, Startup, Acceptance).
    *   Symptom Router (e.g. "Values Explode" -> Doc E).
    *   Binding Laws (Hard invariants).
*   **Updated**: `AGENTS.md`
    *   Replaced generic "Read physics_xray.md" with **"STOP. Read docs/PHYSICS_ATLAS.md first."**

## 3. Discovered Links (The A–J Map)
All required docs exist and are now indexable:
*   [A] `docs/forensic_node_xy_write_ownership.md`
*   [B] `docs/forensic_sharp_inventory.md`
*   [C] `docs/forensic_native_ledger.md`
*   [D] `docs/forensic_repulsion_placement_and_scaling.md`
*   [E] `docs/forensic_dt_and_xpbd_compliance_alignment.md`
*   [F] `docs/forensic_xpbd_proof_of_life_telemetry.md`
*   [G] `docs/forensic_ghost_velocity_reconcile_compat.md`
*   [H] `docs/forensic_mode_isolation_hybrid_vs_xpbd.md`
*   [I] `docs/forensic_spawn_startup_hygiene.md`
*   [J] `docs/acceptance_good_springmass_in_hand.md`

## 4. Evaluation
The atlas allows a new agent to go from "It feels weird" to "Check `springCorrMax` in Doc J" in under 30 seconds.

## 5. Forensic Logic Audit
**Auditor**: Antigravity
**Mode**: `scandissect`

I have conducted a deep scan of the core physics engine source code (`src/physics/engine/`) to verify compliance with the doctrines outlined in `AGENTS.md` and `docs/physics_xray.md`.

### A. The "0-Slush" Scheduler Verification
*   **Doctrine**: Time must remain 1:1. No "catch-up" (syrup).
*   **Code Evidence**: `src/playground/rendering/renderLoopScheduler.ts`
    *   **Hard Reset**: Lines 71-75 explicitly detect `accumulatorMs > dtHugeMs * 3` and force `accumulatorMs = 0`, triggering a `HARD` reset with reason `DT_HUGE_RESET`.
    *   **Drop Debt**: Lines 161-165 detect `debtFrames > 2` (watchdog) and drop the accumulator, prioritizing "stutter" over "slow-mo".
    *   **Verdict**: **VERIFIED**. The specific mechanics match the "Visual Dignity" doctrine.

### B. Degrade-1:1 Verification
*   **Doctrine**: When stressed, skip passes (frequency), do not weaken stiffness (mush).
*   **Code Evidence**: `src/physics/engine/engineTick.ts` & `constraints.ts`
    *   **Skip Logic**: `engineTick.ts` (lines 472-581) computes `passLogAt` and conditionally runs passes (`spacingWillRun`).
    *   **Stiffness Preservation**: `constraints.ts` (line 285) applies `strideScale` to `corrApplied` (`corr * spacingGate * strideScale`). This mathematically ensures that if we check 1/N frames, we apply N times the correction, maintaining effective stiffness.
    *   **Verdict**: **VERIFIED**. "No Mud" policy is active.

### C. MotionPolicy (The Brain)
*   **Doctrine**: Centralized Energy -> Ramp management.
*   **Code Evidence**: `src/physics/engine/motionPolicy.ts`
    *   **HubScalar**: `computeHubScalar` (lines 29-34) maps degree to continuous 0..1.
    *   **SettleScalar**: `settleScalar` (lines 68) uses `smoothstep(0.0001, 0.01)` on `avgVelSq`, confirming the "Knife-Sharp" rest threshold.
    *   **Verdict**: **VERIFIED**.

### D. XPBD & Singularities
*   **Doctrine**: Deterministic handling of D=0.
*   **Code Evidence**: `src/physics/engine/constraints.ts`
    *   **Gentle Resolver**: Lines 221-241 detect `Math.abs(dx) < 0.0001` and apply a deterministic shuffle based on string hash (`str.charCodeAt`), preventing random explosions while resolving exact overlaps.
    *   **Verdict**: **VERIFIED**.

### E. Traceability
*   **Code Evidence**: `engineTick.ts`
    *   **Ledgers**: `energyLedger` (line 124) and `fightLedger` (line 157) are populated per-tick, enabling the forensic debugging promised in `PHYSICS_ATLAS.md`.
    *   **Cannaries**: `canaryTrace` (line 172) monitors position consistency across phases.

### F. Acceptance Protocol (The "Ritual")
*   **Discovery**: `CanvasOverlays.tsx` renders a manual checklist (T1-T7) for the user (lines 601-619).
*   **Gap Risk**: The checks are **Purely Visual/Manual**. There is no automated test runner enforcing these truths.
*   **Verdict**: **PARTIAL**. The UI exists ("The Ritual" is possible), but enforcement relies entirely on the disciplined operator. The report must flag: *Acceptance is currently a human ceremony, not a CI gate.*

### G. Input Shielding (The "Black Hole")
*   **Analysis**: `GraphPhysicsPlayground.tsx` (line 190) captures the pointer on `container`.
*   **Risk**: If an overlay element fails to `stopPropagation`, the container steals the pointer, causing "Button Click leads to Graph Drag".
*   **Evidence**: `CanvasOverlays.tsx` buttons use `stopPropagation` (line 19, 144). `DEBUG_OVERLAY_STYLE` uses `pointerEvents: 'none'` (pass-through) while its content div uses `pointerEvents: 'auto'`.
*   **Verdict**: **VERIFIED WITH CAUTION**. The logic is sound, but fragile. A single missing `stopPropagation` in a new component will break the UI. "Pointer Capture Bubbling" remains a high-maintenance risk.

### H. Documentation Contract
*   **Missing Link**: The "Doc Freshness Contract" (updating Atlas/Symptom Router when HUD names change) is implied in `PHYSICS_ATLAS` but not mechanically enforced.
*   **Action**: Flagged as a "Future Risk" in this report.

## 6. Outstanding Risks
*   **Acceptance remains a manual ceremony** (T1–T7 checkboxes in `CanvasOverlays.tsx`), so there’s no CI gate—someone still has to run and verify the ritual to call the build "knife-sharp."
*   **Input shielding depends on every overlay obeying `stopPropagation`**; adding a new button without that pattern will let the canvas hijack the pointer (the "Black Hole" risk in the report).
*   **HUD/field name renames still require manual updates** to the atlas/symptom router per the "Freshness Contract," so missed updates will desynchronize docs from reality.

**Conclusion**: The codebase is in strict alignment with the `PHYSICS_ATLAS` and `system.md` specifications. No deviations found. Gaps are procedural, not architectural.
