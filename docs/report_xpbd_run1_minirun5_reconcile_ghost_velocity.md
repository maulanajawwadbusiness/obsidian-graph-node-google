# XPBD Run 1: Mini Run 5 - Ghost Velocity Reconcile

## Goal
Implement strict history reconciliation to ensure position projections do not become "fake momentum" (ghost velocity).

## Implementation Details

### 1. Motion Model (Explicit Choice: Verlet-Consistency)
-   **Engine State**: Hybrid, but `prevX/prevY` governs implicit velocity rebuilding in many paths.
-   **Chosen Rule**: **Verlet-Consistency**.
    -   Logic: "If position changes by $\Delta$, history must change by $\Delta$ to preserve Velocity."
    -   Reasoning: Velocity $v$ is derived as $(x - prevX) / dt$. If we only move $x$ (Projection), $v$ spikes. Moving both preserves the existing $v$ while teleporting the body.
    -   Constraint: This assumes `(x - prevX)` is the dominant source of truth for momentum continuity.

### 2. Logic Changes
-   **File**: `src/physics/engine/engineTickXPBD.ts`
-   **Removed**: `ADJUST_PREV_ON_SOLVE` (Inline hack removed).
-   **Added**: `reconcileAfterXPBDConstraints(engine, snapshot, nodes, dt)`
-   **Flow**:
    1.  `snapshot = new Float32Array(...)`
    2.  `solveXPBDEdgeConstraints(...)`
    3.  `reconcileAfterXPBDConstraints(...)`

### 3. Telemetry
-   **Ghost Vel**: $v_{ghost} = \Delta / dt$.
-   **Max**: Peak ghost velocity seen this frame.
-   **Events**: Count of nodes where $v_{ghost} > 100px/s$.
-   **Sync**: Count of nodes reconciled.

### 4. UI changes
-   **HUD**: Added `ghost` line in XPBD Springs block.
    -   `ghost: [Max]px/s (evt: [Count])`
    -   `sync: [Count]`

## Verification Procedure (Manual)

### 1. Launch & Observe
-   **Action**: `npm run dev`
-   **Check**: XPBD Springs block visible. `sync` count should match active constraints/nodes being moved.

### 2. Drag Test (Zero Porridge)
-   **Action**: Drag a node vigorously and release.
-   **Expectation**:
    -   **Motion**: Node should settle naturally. No "kickback" or "explosion".
    -   **Ghost**: `ghost` velocity should spike during drag (as we force positions), but `evt` should settle to 0 at rest.
    -   **Sync**: Should be active during drag/settle.

### 3. Separation Test
-   **Action**: Drag two connected nodes apart.
-   **Expectation**: They pull together. `ghost` velocity reflects the solver correction speed.

## Invariants Verified
1.  **PrevX Sync**: Every solver position change ($\Delta$) is matched by $\Delta$ in `prevX`.
2.  **No Double Dipping**: `ADJUST_PREV_ON_SOLVE` logic removed to avoid applying it twice.
3.  **Thread Safety**: Snapshot uses local `Float32Array`, no shared state issues.
