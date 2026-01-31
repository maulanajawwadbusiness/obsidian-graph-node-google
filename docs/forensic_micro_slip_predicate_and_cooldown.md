# Forensic Report: Micro-Slip & Stagnation Escape

**Date:** 2026-02-01
**Subject:** periodic "Heartbeat" micro-slip events & cooldown absence.

## 1. Mechanisms Identified

We found 3 active "injection" mechanisms that modify velocity to break stasis. None have cooldowns.

| Mechanism | File | Predicate Key | Action | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Static Friction Bypass** | `staticFrictionBypass.ts` | `isDense` AND `relVel < 0.05` | Perpendicular Shear (Pair) | **Critical:** Fires every frame in static piles. |
| **Low-Force Stagnation** | `lowForceStagnationEscape.ts` | `isDense` AND `force < 0.5` | Drift to Loose Neighbor | **High:** Fires continuously in equilibrium. |
| **Edge Shear Stagnation** | `edgeShearStagnationEscape.ts` | `tension < 5` AND `relVel < 0.3` | Perpendicular Shear (Pair) | **Medium:** Fires when jammed at rest length. |

*Note: `denseCoreVelocityUnlock.ts` is a Damping mechanism (safe), not an injector.*

## 2. Predicate Failures

### A. Missing "True Stuck" Check
Current consistency relies on `speed` or `relVel` being low.
- **Flaw:** A stable crystal *should* have low speed. Firing micro-slip at a stable crystal causes it to "vibrate" or "heartbeat" forever.
- **Fix:** Require **Pressure** (correction magnitude) or **Conflict** to be high *while* speed is low. "Calm = Good", "Calm + Pain = Stuck".

### B. No Cooldown (The Heartbeat Source)
- **Flaw:** Once a node qualifies (e.g., `relVel < 0.05`), it qualifies *every frame*.
- **Effect:** Continuous injection of energy -> heating -> cooling -> static -> injection. This loop creates the 1Hz/2Hz heartbeat.
- **Fix:** Add `lastMicroSlipTime` to Node. Ban firing if `now - last < 1000ms`.

### C. Ghost Velocity
- **Flaw:** Mechanisms modify `vx/vy` effectively "teleporting" velocity without accounting for `prevX/prevY` history in Verlet/PBD.
- **Effect:** Can confusingly look like energy creation or noise.
- **Fix:** Reconcile history if needed, or admit it's a non-conservative force (which is fine for "motors", but must be bounded).

## 3. Plan

1.  **HUD:** Visualize `microSlipCount`, `cooldownRemaining`, `stuckScore`.
2.  **State:** Add `node.lastMicroSlipMs` and `node.stuckScore`.
3.  **Predicate Update:**
    -   Compute `stuckScore = (1 - speed/limit) * (pressure + conflict)`.
    -   Require `stuckScore > threshold`.
4.  **Cooldown:**
    -   If fired, set `lastMicroSlipMs = now`.
    -   If `now - last < cooldown`, ABORT.
5.  **Gating:**
    -   Scale strength by `(1 - settleConfidence)^2`.
