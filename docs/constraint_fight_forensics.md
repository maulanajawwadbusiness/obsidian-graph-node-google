# Constraint Fight Forensics Report

## Objective
Isolate the source of "Micro-Jitter" (permanent residual motion) by analyzing the interaction between the PBD Solver (Constraints) and the Integrator (Velocity).

## The "Fight" Definition
A **Constraint Fight** occurs when the Physics Integrator wants to move a node in direction $\mathbf{v}$, but the PBD Solver applies a correction $\mathbf{\Delta x}$ in the *opposite* direction ($\mathbf{v} \cdot \mathbf{\Delta x} < 0$).
*   **Healthy**: High conflict during settling (brakes).
*   **Unhealthy**: High conflict at rest (vibration).

## Tick Order & Instrumentation
The engine tick executes in this precise order. We have instrumented measurements at each cut point.

| Stage | Action | Fight Metric |
| :--- | :--- | :--- |
| **PreTick** | Start of frame | Energy Baseline |
| **PostForces** | Repulsion, Gravity | - |
| **PostVMods** | Drag, PreRoll (Velocity Mods) | - |
| **PostInteg** | Explicit Integration ($x += v \cdot dt$) | - |
| **PostConstraints** | *Calculate* spacing, safety, etc. | **Potential Conflict**: Checks accumulated $\Delta x$ vs $v$. |
| **PostReconcile** | *Apply* corrections (`applyCorrectionsWithDiffusion`) | **Actual Conflict**: Checks resolved $\Delta x$ vs $v$. |

## Isolation Toggles (Advanced)
Use the **Advanced Physics Toggles** in the HUD to narrow down the noise source.

### 1. Disable Constraints (`debugDisableConstraints`)
*   **Effect**: Skips `applySpacingConstraints`, `applySafetyClamp`, etc. No corrections are generated.
*   **Hypothesis**: If jitter stops, the *calculation* of constraints is noisy (e.g. fighting spacing, or unstable triangle areas).

### 2. Disable Reconcile (`debugDisableReconcile`)
*   **Effect**: Skips `applyCorrectionsWithDiffusion`. Corrections are calculated but *discarded*.
*   **Hypothesis**: If jitter stops, the *application* logic (diffusion, budget clipping) is introducing noise.

### 3. Disable V-Mods (`debugDisableAllVMods`)
*   **Effect**: Skips Drag, PreRoll, MicroSlip, etc.
*   **Hypothesis**: If jitter stops, a velocity modifier allows energy to leak back in (negative damping).

## Missing Reconcile Step?
**Finding**: Our engine does **not** have an explicit Velocity Reconcile step ($v = (x_{new} - x_{old}) / dt$) after PBD.
*   **Current Behavior**: Constraints modify $x$, but $v$ remains "pre-constraint".
*   **Risk**: This is physically incorrect and causes "Energy Loss" (damping) implicitly, but can also cause "Energy Gain" if the integrator overshoots next frame because $v$ wasn't cancelled by the wall collision.
*   **Watch**: If `postCorrect` energy is high, this missing step is the prime suspect.

## Triage Procedure
1.  Open HUD -> Check "Show Advanced".
2.  Enable **No Reconcile**.
    *   Does it settle? (Nodes will overlap, but strictly stop moving?)
    *   If YES: The Solver is the motor.
3.  Enable **No Constraints** (and uncheck No Reconcile).
    *   Does it settle?
4.  Check **Fight Ledger**:
    *   Is **PostConstraints** showing > 50% Conflict?
    *   Is **AvgCorr** fluctuating > 0.001 at rest?
