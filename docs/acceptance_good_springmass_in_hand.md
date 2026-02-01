# Acceptance Tests: "Good Spring-Mass" (Hand-Verifiable)
**Date:** 2026-02-01
**Status:** READY FOR VERIFICATION

## 1. Definition of "Good Spring-Mass" (The Feel)
To pass acceptance, the graph must feel like a **physical object**, not a software diagram.
*   **Crisp Response**: When you grab a node, it follows *instantly*. No "mushy" delay. The link stretches immediately.
*   **Elastic Recoil**: When released, it springs back with 1–3 clean overshoots, then damps to a stop. It should not oscillate forever (under-damped) or crawl back (over-damped).
*   **Solid Collisions**: Nodes pushed together should fight back. They should not slide through each other like ghosts ("overlap soup").
*   **Calm Rest**: Once settled, the graph must be dead still. No vibrating, no "buzzing", no drift.
*   **Consistency**: A graph of 5 nodes should feel the same "law" as a graph of 60 nodes (just heavier).

## 2. Setup
1.  Open the Playground.
2.  Open **Debug Panel**.
3.  Use the **Harness** buttons to switch scenarios (N=5, N=20).
4.  Use the **Acceptance Tests** checklist in the HUD to mark progress (visual only).

## 3. The Tests (T1–T7)

### T1: Single-Node Drag Response
**Goal:** Verify latency and immediate spring engagement.
*   **Setup:** Click **N=20**. Pick a node with 2–4 links.
*   **Gesture:** Click-drag quickly (~150px) and hold for 1s.
*   **Expected Feel:** The node sticks to the cursor. Neighbors visibly stretch *immediately*.
*   **HUD Pass Criteria:**
    *   During drag: `ticksThisFrame` is stable (likely 1 or higher if catching up).
    *   `springConstraintsCount` > 0.
    *   `springCorrMaxPx` is **visibly non-zero** (e.g. > 1.0px) during the stretch.

### T2: Elastic Recoil (Ringdown)
**Goal:** Verify damping ratio (aiming for ~0.7 to 0.9).
*   **Gesture:** Pull a cluster sideways (stretch springs) and **release**.
*   **Expected Feel:** The node springs back past the goal, returns, maybe passes once more, then stops.
    *   *Fail:* Stops instantly (too heavy).
    *   *Fail:* Bounces for >3 seconds (too light).
*   **HUD Pass Criteria:**
    *   `energyProxy` (v²) spikes on release, then decays monotonically.
    *   `oscillation > Flip Rate` might flash briefly but should die down.
    *   **Settle State** returns to `sleep` (or `microkill`) within 4 seconds.

### T3: Collision Firmness
**Goal:** Verify repulsion force placement and magnitude.
*   **Gesture:** Drag a node *into* a dense cluster (force it to overlap others).
*   **Expected Feel:** Resistance. The other nodes should scatter/push away. You should NOT be able to easily stack nodes on top of each other.
*   **HUD Pass Criteria:**
    *   `overlapCount100` (Physical Overlap) might spike to 1–2 briefly but must **return to 0** quickly.
    *   `nearOverlapCount` (Warning Zone) will be high during contact.
    *   `repulsionMaxMag` should spike (showing force is active).
    *   **CRITICAL:** `repulsionClampedCount` should generally stay low/zero (forces shouldn't need clamping if tuned right).

### T4: Locality (No Teleport)
**Goal:** Verify mass propagation.
*   **Gesture:** Drag a leaf node (1 link). Then drag a hub (5+ links).
*   **Expected Feel:**
    *   **Leaf:** Only the immediate neighbor moves. The rest of the graph stays still.
    *   **Hub:** The whole connected cluster moves, but with a physical "wave" delay (propagation).
*   **HUD Pass Criteria:**
    *   `activeNodes` (if visible) or `energyProxy` should be much lower for Leaf drag than Hub drag.
    *   `maxPrevGap` (Ghost Velocity) should remain low (< 100px) – no teleportation.

### T5: Rest Truth (No Jitter)
**Goal:** Verify solver stability and "Sleep" mode.
*   **Setup:** Stop touching. Wait 10s.
*   **Expected Feel:** Dead silence. No pixel crawling.
*   **HUD Pass Criteria:**
    *   **Settle State**: MUST show `sleep`.
    *   `jitterAvg`: Should be `0.000` or extremely low (< 0.01).
    *   `pbdCorrectionSum`: Should be `0.00` (or extremely close).
    *   `energyProxy`: `0.00`.
    *   `microSlipFiresPerSec`: 0.0.

### T6: DT Quarantine (Spike Recovery)
**Goal:** Verify the "Firewall" against browser lag.
*   **Gesture:** Tab away from the window for 5 seconds. Tab back.
*   **Expected Feel:** The graph should **not explode**. It might snap/teleport slightly as it catches up, or freeze-and-resume, but it must not scatter to infinity.
*   **HUD Pass Criteria:**
    *   `dtClampCount`: Increments by at least 1.
    *   `strictClampActive`: Might flash `TRUE` then `FALSE`.
    *   `strictClampActionAppliedCount`: Increments (proving the safety brake worked).
    *   `nanCount`: **MUST BE 0**.

### T7: Cross-Count Consistency
**Goal:** Verify scale invariance.
*   **Action:** Repeat T1 and T2 for **N=5** and **N=60**.
*   **Expected Feel:**
    *   N=5: Snappy, lightweight.
    *   N=60: Heavier, more "inertia", but *same rules*. Not sluggish/broken.
*   **HUD Pass Criteria:**
    *   `perDotUpdateCoveragePct`: Should be 100% for N=5/60 (unless we hit extreme N > 200).
    *   **Degrade Level**: Should stay `0` (Green) for N=60 on a decent machine.

## 4. Troubleshooting
*   **"It feels mushy"**: Check `dt`. If < 60fps, increase `substeps` or check `perfMode`.
*   **"It vibrates"**: Check `restFlapRate` or `microSlipFires`. If high, the "Stop" threshold is too aggressive or conflicting with repulsion.
*   **"It explodes on Tab switch"**: `maxVelocity` cap is failing. Check `firewallStats`.
