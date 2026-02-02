# Run 5: Ensure XPBD Core Consumes XPBD Damping (XPBD Damping)

**Date**: 2026-02-02
**Agent**: Antigravity

## Objective
Verify that the `xpbdDamping` value, once it reaches the physics tick, is actually used in the integration step and not ignored or overridden by legacy logic.

## Findings
1.  **Tick Logic**: `engineTickXPBD.ts` correctly reads `engine.config.xpbdDamping`, applies a fallback to `DEFAULT_XPBD_DAMPING` if undefined, and clamps it to a safe range (`effectiveDamping`).
2.  **Integration Path**: This `effectiveDamping` value is passed explicitly to `integrateNodes` in `src/physics/engine/integration.ts`.
3.  **Damping Application**: `integrateNodes` calls `applyDamping` (in `src/physics/engine/velocity/damping.ts`), which applies exponential decay: `velocity *= Math.exp(-effectiveDamping * 5.0 * dt)`.
4.  **Legacy Interference**: Checking `integrateNodes` confirmed that legacy velocity modifiers like `applyCarrierFlowAndPersistence` and `applyHubVelocityScaling` are gated behind `!useXPBD`, ensuring they do not interfere when XPBD is active.

## Verification
The dataflow is confirmed unbroken from Config -> Tick -> Integration -> Velocity Update. The mathematical application is consistent with expected damping behavior.

## Next Steps
Proceed to Run 6 to clean up the temporary probes installed in Run 1 and leave a single "revert guard" to monitor for any future regressions.
