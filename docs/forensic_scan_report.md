# Forensic Scan Report: Diffusion Hardening & Ghost Velocity Fix

## Summary
- Reviewed `docs/forensic_diffusion_decay_and_history_reconcile.md` and compared it to the corresponding physics implementation to surface proof points, regressions, and instrumentation gaps.
- No code edits were made per the request.

## Findings

1. **HUD snapshot uses an uninitialised `motionPolicy` (source: `src/physics/engine/engineTick.ts#L193`).**  
   `debugStats.diffusionGate` is computed before the `const motionPolicy = createMotionPolicy(...)` declaration. In modern JS/TS this lives inside the temporal-dead-zone and currently throws `ReferenceError: Cannot access 'motionPolicy' before initialization` as soon as debug stats are built, so the HUD never receives a valid diffusion gate snapshot.

2. **`diffusionStrengthNow` never resets when diffusion is inactive (source: `src/physics/engine/corrections.ts#L272-L321`).**  
   That metric is updated only inside the `if (degree > 1 && enableDiffusion)` branch. Once diffusion gates off—either because a node has degree 1 or `enableDiffusion` is false—the assignment never runs, leaving the HUD with the last non-zero value. The doc claims this field reports the *current* strength, but the wiring never sets it back to `0`, so calm frames show stale positive values.
