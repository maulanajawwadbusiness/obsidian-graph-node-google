# PHYSICS ATLAS: The Knife-Sharp Entry Point
**Status:** ALIVE
**Maintainer:** Physics Core Team
**Truth Source:** `docs/acceptance_good_springmass_in_hand.md`

> **STOP.** If you are new to this physics engine, **DO NOT TOUCH CODE** until you have read the [Acceptance Spec](acceptance_good_springmass_in_hand.md) and verified T1–T7 in the Playground.

## 1. North Star: "Good Spring-Mass"
The graph is a **physical object**, not a diagram. It must pass the **Hand-Feel Protocol**:
1.  **Crisp:** 1:1 drag response. No mush.
2.  **Elastic:** Clean ringdown (1–2 overshoots). No jelly.
3.  **Solid:** Hard collisions. No overlap soup.
4.  **Calm:** Dead silence at rest (Jitter < 0.005).

**Use the HUD Checklist** (Right Column) to verify T1–T7.
*   [T1] Drag (Gap < 50px)
*   [T2] Recoil (< 3s)
*   [T3] Collision (Recovery 1.0–1.5s)
*   [T4] Locality (No Teleport)
*   [T5] Rest (Sleep)
*   [T6] DT Quarantine (Proof)
*   [T7] Scale Invariant (5/60/250)

---

## 2. Document Map (The A–J Canvas)
Every subsystem has a forensic trace. Use this map to find the "Why".

| ID | Domain | Question Answered | Canonical Doc | HUD/Telemetry Proof |
| :--- | :--- | :--- | :--- | :--- |
| **A** | **Data Ownership** | Who writes `node.x/y`? | [forensic_node_xy_write_ownership.md](forensic_node_xy_write_ownership.md) | `debugNoRenderMotion` |
| **B** | **Inventory** | Where are all forces/motors? | [forensic_sharp_inventory.md](forensic_sharp_inventory.md) | `debugDisableAllVMods` |
| **C** | **Magnitudes** | What are the real runtime units? | [forensic_native_ledger.md](forensic_native_ledger.md) | `repulsionMaxMag`, `springCorrMax` |
| **D** | **Repulsion** | Why doesn't it explode? | [forensic_repulsion_placement_and_scaling.md](forensic_repulsion_placement_and_scaling.md) | `nearOverlapCount`, `repulsionClamped` |
| **E** | **XPBD/DT** | Is dt usage correct? | [forensic_dt_and_xpbd_compliance_alignment.md](forensic_dt_and_xpbd_compliance_alignment.md) | `dtSkewMaxMs` |
| **F** | **Telemetry** | Is XPBD actually running? | [forensic_xpbd_proof_of_life_telemetry.md](forensic_xpbd_proof_of_life_telemetry.md) | `xpbdSpringCounts` |
| **G** | **Ghost Vel** | Why do nodes teleport? | [forensic_ghost_velocity_reconcile_compat.md](forensic_ghost_velocity_reconcile_compat.md) | `maxPrevGap`, `ghostVelSuspectCount` |
| **H** | **Isolation** | Is Legacy interfering? | [forensic_mode_isolation_hybrid_vs_xpbd.md](forensic_mode_isolation_hybrid_vs_xpbd.md) | `mode` text (HUD top) |
| **I** | **Startup** | Why does spawn explore? | [forensic_spawn_startup_hygiene.md](forensic_spawn_startup_hygiene.md) | `startupNanCount`, `minPairDist` |
| **J** | **Acceptance** | **Is it good?** | [acceptance_good_springmass_in_hand.md](acceptance_good_springmass_in_hand.md) | **T1–T7 Checklist** |

---

## 3. Symptom Router
*Fast-path diagnosis: "I see X, where do I look?"*

| Symptom | Probable Cause | First Doc | HUD Check |
| :--- | :--- | :--- | :--- |
| **"Node teleports when I let go"** | Ghost Velocity mismatch (prevX vs x) | **[G] Ghost Vel** | `maxPrevGap` > 100px |
| **"Graph vibrates at rest"** | Solver fighting or Damping failure | **[C] Magnitudes** | `jitterAvg` > 0.05 |
| **"Explosion on Tab Switch"** | DT Firewall breached | **[E] XPBD/DT** | `dtClampCount` (must inc) |
| **"Nodes merge like soup"** | Repulsion too weak / Radius mismatch | **[D] Repulsion** | `nearOverlapCount` stays high |
| **"Motion is mushy/slow"** | Drag Latency or Over-damping | **[J] Acceptance (T1)** | `springCorrMax` < 1.0 (dead) |
| **"Spawn flings nodes away"** | Startup hygiene (Overlap strictness) | **[I] Startup** | `startupMaxSpeed` > 2000 |

---

## 4. Binding Laws
These are the **Hard Invariants**. Breaking them breaks the engine.

1.  **Deterministic Quarantine**: The startup phase (< 2.0s) MUST be deterministic to allow identical hydration. Randomness is seeded/hashed.
2.  **DT Firewall**: If `dt > 200ms`, the engine MUST clamp or slice. Never integrate a 1s delta.
3.  **Visual Truth**: `node.x/y` is ONLY written by the integrator or the user (drag). Render loop must NOT mutate physics state.
4.  **Unit Invariance**: Physics runs in **World Space**. Zoom level (Canvas transform) must NOT affect force magnitudes.

## 5. Maintenance
*   **When to update:** If you add a new solver, a new force, or change the `TimePolicy`.
*   **How to update:**
    1.  Create a new `forensic_*.md` doc.
    2.  Add it to the **Document Map** (Table 2).
    3.  Update **Symptom Router** if it fixes a known bug.
*   **Truthiness:** Ideally, run `scandissect` on the codebase to verify the map is still accurate.
