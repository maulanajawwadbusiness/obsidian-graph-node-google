# Forensic Report: XPBD Proof-of-Life Telemetry
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** VERIFIED & CONSISTENT

## 1. Goal
Provide immediate, **"no-console required"** verification that the new systems (Springs & Repulsion) are running. The user must be able to confirm "Life" via the HUD and visible physical effects.

## 2. Telemetry Implementation (The One Truth)

### A. Safe Canary Shift (`debugXPBDCanary`)
A **One-Shot Nudge** to prove write-ownership without destroying the simulation.
*   **Logic**:
    *   `if (!engine.xpbdCanaryApplied)`: Applies `node[0].x += 30` **exactly once**.
    *   Latches `true` until toggle is disabled.
    *   Occurs at **Pre-Tick**, verifying that `engineTick` writes are not overwritten by render interpolation.
*   **Visible Effect**: Node 0 teleports 30px right instantly, then behaves normally. No continuous "flying".
*   **Location**: `src/physics/engine/engineTick.ts`, lines ~160.

### B. "Real" Force Repel (`debugForceRepulsion`)
A dramatic override to prove the Repulsion function is running.
*   **Logic**:
    *   Overrides `config.minNodeDistance` to **140px** (Mode A).
    *   Boosts `repulsionStrength` by **2x**.
*   **Visible Effect**: Nodes exploded apart to create massive gaps. Unmistakable.
*   **Location**: `src/physics/forces.ts`, lines ~26.

### C. Reset Semantics & Frame Sums
*   **Stats (`DebugStats`)**: Reset every **Physics Tick**.
*   **HUD (`PhysicsHudSnapshot`)**: Accumulated for the **Render Frame**.
*   **Mechanism**:
    *   `engine.xpbdFrameAccum` sums sub-ticks (Catch-Up).
    *   `ticksThisFrame`: Shows how many physics ticks happened this render frame (0, 1, or more).
    *   `dtUseSecFrameAvg`: Averaged `dt` across sub-ticks.

## 3. Reality Checklist (What Runs TODAY)

Since the *Legacy Solver* is still active and the *XPBD Solver* is not yet integrated, here is the exact status of each indicator:

| Feature | Active? | Expected HUD Value | Visible Physical Effect? |
| :--- | :--- | :--- | :--- |
| **Canary Shift** | **YES** | `xpbdCanaryActive: true` | **YES** (Jump) |
| **Force Repel** | **YES** | `repulsionEvents: >0` (from Legacy Safety) | **YES** (Explosion) |
| **Stiff Links** | NO | `xpbdSpringCounts: 0` | None (Pending Solver) |
| **HUD: Ticks/Frame** | **YES** | `ticksThisFrame: 1-3` | N/A |
| **HUD: XPBD Stats** | NO | `xpbdSpring*: 0`, `xpbdRepel*: 0` | None (Pending Solver) |

**Note:** `repulsionEvents` in HUD currently maps to `stats.safety.repulsionClampedCount`, which IS populated by the current `applyRepulsion`. So you *will* see activity there.

## 4. Verification Steps (10 Seconds)

1.  **Toggle Canary**:
    *   Action: Enable `debugXPBDCanary`.
    *   Check: Node 0 jumps ONCE.
    *   HUD: `Canary: ON`.

2.  **Toggle Repel**:
    *   Action: Enable `debugForceRepulsion`.
    *   Check: Nodes fly apart (140px gaps).
    *   HUD: `Repulsion Events` number climbs rapidly.

3.  **Check Heartbeat**:
    *   HUD: `Ticks/Frame` should be flickering `1` (or `2-3` if lagging).
    *   HUD: `Avg DT` approx `0.016` (60Hz).

## 5. Artifacts
*   `docs/forensic_xpbd_proof_of_life_patch_notes.md`: Detailed changelog of edits.
*   `src/physics/engine/engineTick.ts`: Canary & Accumulators.
*   `src/physics/forces.ts`: Repulsion Override.
*   `src/physics/engine/physicsHud.ts`: Snapshot Definitions.

**Conclusion:** Telemetry is fully instrumented. Repulsion and Canary are live. XPBD specific counters will light up the moment `solveXPBDConstraints` is wired in.
