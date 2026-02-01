# Acceptance Spec: "Good Spring-Mass" (Hand-Verifiable)
**Date:** 2026-02-01
**Status:** SPECIFICATION (Rigorous)

## 1. Goal: "The Feel"
The graph must feel like a **physical object**, not a software diagram.
*   **Crisp:** Instant 1:1 response to cursor. No "mush".
*   **Elastic:** Springs snap back with 1–2 clean overshoots. No infinite wobble.
*   **Solid:** Nodes are hard marbles, not ghosts. They fight overlap.
*   **Calm:** Rest is DEAD silence. No micro-crawling.

## 2. Preconditions & Setup
*   **Mode:** Hybrid (Default) or XPBD (if toggled).
*   **Config:** Default physics config.
*   **Toggles:**
    *   `microSlip`: ON (unless debugging drift).
    *   `diffusion`: ON.
    *   `repulsion`: ON.
*   **HUD:** Open Debug Panel -> Right Column.

## 3. Test Definitions (T1–T7)

### T1: Drag Response (Latecy & Stiffness)
**Action:** Select N=20. Grab a node (with links) and **whip** it back and forth, then hold.
*   **Expected Feel:** The node is "stuck" to the cursor. The links stretch *instantly*. No "lazy elastic" delay.
*   **Expected HUD:**
    *   `ticks/frame`: **STABLE** (should not drop to 0 or 0.5).
    *   `springCorrMax`: **> 2.0px** (during whip). Proves forces are fighting.
    *   `maxPrevGap`: **< 50px** (Ghost velocity matches cursor).

### T2: Elastic Recoil (Ringdown)
**Action:** Pull a node/cluster 200px sideways (max stretch) and **release**.
*   **Expected Feel:** The node shoots back, overshoots target, returns, overshoots slightly, then stops.
    *   *Pass:* 1 to 3 visible reversals.
    *   *Fail:* stops instantly (over-damped mud).
    *   *Fail:* bounces > 3s (under-damped jelly).
*   **Expected HUD:**
    *   `energyProxy`: Spikes, then decays monotonically.
    *   `settleState`: Transitions: `moving` -> `cooling` -> `sleep` in **< 3.0s**.

### T3: Collision Firmness (Repulsion)
**Action:** Drag a node *into* a dense 5-node cluster. Force them to overlap.
*   **Expected Feel:** "Magnetic resistance". Nodes slide around the intruder, but do NOT merge.
*   **Expected HUD:**
    *   `nearOverlapCount`: Spikes (war zone), then **returns to 0** within **1.0s** of stopping.
    *   `repulsionMaxMag`: **> 5.0** (Strong forces active).
    *   `repulsionClamped`: **0** (Ideally) or low single digits (if chaos).

### T4: Locality (Wave Propagation)
**Action:** Drag a **Leaf** (1 link). Then drag a **Hub** (5+ links).
*   **Expected Feel:**
    *   *Leaf:* Only the neighbor moves. World stays still.
    *   *Hub:* The immediate cluster follows. A "wave" moves outward. Far nodes stay still.
*   **Expected HUD:**
    *   `maxPrevGap`: **< 100px** (NO TELEPORTATION).
    *   `activeNodes` (if visible): Leaf < Hub.

### T5: Rest Truth (Silence)
**Action:** Hands off. Wait 5s.
*   **Expected Feel:** DEAD SILENCE. No pixel crawling. No "breathing".
*   **Expected HUD:**
    *   `settleState`: **MUST BE 'sleep'**.
    *   `jitterAvg`: **< 0.005** (Micro-sub-pixel).
    *   `energyProxy`: **0.00**.
    *   `microSlipFires`: **0.0/s**.

### T6: DT Quarantine (Spike Recovery)
**Action:** Tab away for 5s. Tab back.
*   **Expected Feel:** No "explosion". Might snap/pop once, then calm.
*   **Expected HUD:**
    *   `dtClampCount`: **increments**.
    *   `strictClampActive`: Flashes **TRUE** then **FALSE**.
    *   `nanCount`: **0** (Always).

### T7: Cross-Count Invariants
**Action:** Run T1 & T2 on N=5, N=60, N=250.

| Metric | N=5 | N=60 | N=250 |
| :--- | :--- | :--- | :--- |
| **FPS** | 60 | 60 | >30 |
| **Settle Time** | < 1.0s | < 3.0s | < 5.0s |
| **Recoil Flips** | 1-2 | 1-3 | 0-1 (Heavier) |
| **Coverage** | 100% | 100% | >50% (if strided) |

## 4. Failure Signatures
*   **Ghosting:** Dragged node leaves a "trail" or snaps late. -> *Tick Loop lag or Render interpolation bug.*
*   **Jelly:** Bounces forever. -> *Damping too low (<0.1).*
*   **Soup:** Nodes merge and stick. -> *Repulsion radius too small or force too weak.*
*   **Explosion:** Tab switch scatters nodes. -> *DT Clamping failed (MaxV exceeded).*
