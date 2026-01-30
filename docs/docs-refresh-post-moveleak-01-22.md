# Documentation Refresh: Post-Move-Leak Hardening (01-22)
**Date:** 2026-01-30
**Status:** Completed

## 1. Overview
Following the successful implementation of 22 distinct fixes for the "Move Leak" phenomena, the repository documentation was outdated. It referenced old physics behaviors (like "slush" or "soft limits") which are now strictly forbidden invariants.

This refresh updates the "Source of Truth" documents (`system.md`, `repo_xray.md`, `physics_xray.md`) to reflect the hardened reality.

## 2. Changes Summary

### A. `docs/system.md`
*   **Physics Architecture**: Rewrote to define the "Hybrid Solver" correctly, including the new **Correction Residue** and **Hot Pair Fairness** subsystems.
*   **Invariants**: Added a new section **Move-Leak Hardening (Invariants)** listing the 3 pillars:
    *   **Render**: Unified Transform, Deadzone (0.5px), Snap (0.05px).
    *   **Physics**: Absolute Fixed Authority, Atomic Cleanup.
    *   **Stability**: Sleep/Wake gates, Degrade Fairness.
*   **Interaction**: Clarified that Drag/Impulse safety is now mathematically enforced (cooldowns, locks).

### B. `docs/repo_xray.md`
*   **Top Files**: Added `src/playground/rendering/camera.ts` as a critical authority file (was previously considered just a helper).
*   **Invariants**: Updated to "Move-Leak Hardened" version (Visual Dignity, Zero-Drift, No Debt Drift).
*   **Runtime Loops**: Clarified that the Physics Loop now runs a **Priority Pass** (Hot Pair Fairness) inside the Degrade cycle.
*   **Logs**: Added `[FixedLeakWarn]` and `[CorrCap]` as critical health signals.

### C. `docs/physics_xray.md`
*   **New Section**: Added **Section 6: Move-Leak Hardening (01-22)**.
*   **Content**: Explicitly maps the 22 fixes to three guard layers (Render, Scheduler, Physics).
*   **Observability**: Updated the log list to prioritize the new warning signals over generic perf stats.

## 3. Remaining Risks / TODO
*   **Visual Verify**: The docs claim "Zero-Drift". This is mathematically true in potential validation, but user perception is subjective. We rely on the `[FixedLeakWarn]` to catch regressions.
*   **Future Docs**: As new features (e.g., semantic clustering) are added, they MUST respect the **Holy Grail Scheduler** (No Syrup) and **Degrade-1:1** (No Mud) contracts defined here.

## 4. Conclusion
The documentation now accurately describes a "hardened" physics engine where drift, creep, and shimmer are considered bugs (violations of invariant contracts) rather than acceptable soft-body behaviors.
