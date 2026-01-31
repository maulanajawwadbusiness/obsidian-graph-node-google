# Physics HUD Usage Guide

## Debug Panel Controls
The Debug Panel overlays the simulation and provides forensic tools.

### Standard Controls (Hidden by Default)
*Toggle "Show Standard Controls" to view:*
*   **Lock Camera**: Freezes camera movement.
*   **Show Grid/Axes**: Displays spatial reference.
*   **Pixel Snapping**: Visually aligns nodes to pixels.
*   **Kill Render Motion**: Stops interpolation (shows raw physics ticks).

### Advanced Physics Toggles
**Note**: To access advanced isolation tools, check **"Show Advanced Physics Toggles"**.
These controls are for developers/forensics only and may break the simulation physics.

*   **No Diffusion**: Disables neighbor-smoothing of corrections.
*   **No MicroSlip**: Disables the dense-core velocity delocking pass.
*   **No Repulsion**: Disables node-node repulsion forces.
*   **No Constraints**: Disables all PBD constraints (spacing, safety, triangle).
*   **No Reconcile**: Disables the final correction application pass.
*   **No V-Mods**: Disables velocity modifiers (drag, pre-roll, etc).

## Ledgers
### Energy Ledger
Shows the total Kinetic Energy ($\sum v^2$) at each stage of the tick.
*   **PreTick**: Energy at start.
*   **PostForces**: After gravity/repulsion. (Usually increases)
*   **PostVMods**: After drag. (Must decrease)
*   **PostInteg**: After integration.
*   **PostCorrect**: After constraints are resolved.

### Constraint Fight Ledger
Shows the "Stress" in the system.
*   **Conflict%**: Percentage of nodes where the proposed correction opposes the current velocity ($v \cdot \Delta x < 0$).
*   **AvgCorr**: Average magnitude of position corrections applied.

**Goal**: A settled graph should have near-zero Energy and very low AvgCorr. High Conflict% at low energy implies the solver is fighting the integrator (jitter).
