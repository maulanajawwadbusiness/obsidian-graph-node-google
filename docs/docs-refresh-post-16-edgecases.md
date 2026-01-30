# Documentation Refresh: Post-16 Edge Cases

## 1. Goal
Synchronize system documentation with the reality of the codebase after implementing fixes for 16 specific energy-leak/stability edge cases.

## 2. Forensic Scan Results
- **System.md**: Correctly identifies "No Syrup" and "Degrade-1:1", but lacks details on recent stability mechanisms like the "Interaction Bubble" (Local Boost) nuance, and the specific failure modes of Fatal containment.
- **Physics_Xray.md**: Needs a section explicitly listing the edge case categories (e.g. "Micro-Drift", "Impulse Guarding") to serve as a manual for future debugging. The "Observability" section needs to include new tags (`[RenderDrift]`, `[Impulse]`, `[DtSkew]`).
- **Repo_Xray.md**: Generally accurate structure-wise, but `engine.ts` line count and responsibility list should be updated to reflect its grown role as the central dispatcher for all these edge case fixes.

## 3. Update Strategy

### A. System.md
- **Reinforce Invariants**: Explicitly state "Hand Authority" means `isFixed=true` + `localBoost` + `noDtSkew`.
- **Update Physics Loop**: Mention the new `PreRoll` -> `Impulse` -> `Escape` -> `Stable` lifecycle.
- **Add Edge Case Doctrine**: Briefly mention that we handle "Micro-Drift" and "Temporal Decoherence" explicitly.

### B. Physics_Xray.md
- **The 16 Edge Cases Table**: Add a lookup table mapping Edge Case ID -> Mechanism -> Code Location.
    - #1-#3: Spacing/Clamping (Constraints)
    - #4-#6: Energy/Damping (Velocity Pass)
    - #7-#9: Sleep/Wake (Engine Loop)
    - #10-#12: Fatal/Kick/Delock (Engine/Impulse)
    - #13-#15: Diffusion/Drag/Skew (Corrections/Integration)
    - #16: Render Drift (Integration/Config)
- **New Diagnostics**: Document `enableMicroDrift` and the `debugPerf` logs.

### C. Repo_Xray.md
- **Hot Files**: Add `integration.ts`, `corrections.ts`, `dragVelocity.ts` to the list of key physics files.
- **Invariants**: Update with "0-Slush" and "Interaction Bubble".

## 4. Execution Plan
1.  Update `docs/system.md`.
2.  Update `docs/repo_xray.md`.
3.  Update `docs/physics_xray.md` (Heavy lift).
4.  Commit.
