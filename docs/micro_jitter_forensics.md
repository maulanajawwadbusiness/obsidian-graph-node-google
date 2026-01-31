# Micro-Jitter Forensics Report

## 1. The Energy Ledger
We have instrumented a per-tick "Energy Ledger" to track where kinetic energy ($\sum v^2$) is being injected or removed. This is visible in the Debug HUD.

### Ledger Stages
*   **PreTick**: Energy at start of frame.
*   **PostForces**: After attraction/repulsion/gravity. (Should increase energy)
*   **PostVMods**: After drag and pre-roll. (Should decrease energy significantly via damping)
*   **PostInteg**: After explicit integration. (Conservation step)
*   **PostMicro**: After dense-core/fluid effects. (*Suspect*: unexpected increase here?)
*   **PostCorrect**: After PBD constraints. (*Suspect*: "fighting" constraints can inject energy)

**Goal**: Identify which stage has a positive $\Delta E$ when the system should be cooling (Total E < 0.01).

## 2. Kill Switches
Use the new "KILL SWITCHES" section in the Debug Panel to surgically disable suspects:

*   **Disable Diffusion**: Turns off `applyCorrectionsWithDiffusion`.
    *   *Hypothesis*: Is neighbor-smoothing acting as an unintentional motor?
*   **Disable Micro-Slip**: Turns off `applyDenseCoreVelocityDeLocking` and related fluid effects.
    *   *Hypothesis*: Are "glitch prevention" nudges actually causing the glitch?
*   **Disable Repulsion**: Turns off node-node repulsion.
    *   *Hypothesis*: Are two nodes stuck in a singularity ($r \to 0$, $F \to \infty$)?

## 3. Injector Census (Static Analysis)
We reviewed the codebase for "Motion Injectors" that might keep the system alive artificially.

| Suspect | Location | Trigger | Risk |
| :--- | :--- | :--- | :--- |
| **Diffusion** | `constraints.ts` | Always active if spacing enabled | **High**: Can propagate oscillations endlessly. |
| **Micro-Slip** | `velocityPass.ts` | `frame % 4 == 0` | **Med**: Explicitly adds random tangent velocity. |
| **Edge Shear** | `velocityPass.ts` | `frame % 4 == 0` | **Med**: Adds velocity to escape stagnation. |
| **Carrier Flow** | `velocityPass.ts` | Expansion phase | **Low**: Should be 0 at rest. |
| **Constraint Fight** | `engineTick.ts` | High density | **High**: If PBD correction opposes Velocity, it adds energy. |

## 4. Conflict Loop Analysis
The **PBD Correction Loop** applies position changes (`dx`, `dy`). If these are not perfectly damped, they convert to velocity in the next frame.
*   **Conflict%** in the HUD measures how often `Correction • Velocity < 0`.
*   If Conflict > 50% near rest, the constraints are vibrating the nodes.

## Recommended Triage Steps
1.  **Open Debug Panel** -> **Kill Switches**.
2.  **Toggle "Disable Micro-Slip"**:
    *   Does `MinSpeedSq` drop to `1e-7`? -> **Found it**. Fix: Gate micro-slip by temperature.
3.  **Toggle "Disable Diffusion"**:
    *   Does it settle? -> **Found it**. Fix: Gate diffusion by `spacingGate`.
4.  **Check Ledger**:
    *   If `PostCorrect` shows consistent `+Delta` -> **Constraint Fighting**. Fix: Increase `correctionDamping` or `maxCorrectionPerFrame`.
