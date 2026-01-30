# Physics Edge Cases #10-#12 Analysis

## 1. Forensic Findings

### Edge Case #10: Fatal Mode Containment
**Current State:**
- In `engine.ts` > `tick()`: When `perfMode === 'fatal'`, the loop runs `applyDragVelocity` -> `applyPreRollVelocity` -> `integrateNodes` and RETURNS.
- **Problem:** `applyBoundaryForce` (screen containment) and `applyCenterGravity` are completely skipped. Nodes will drift off-screen or explode if they have residual velocity.
- **Fix:** Must include `applyBoundaryForce` (or a cheap version) inside the fatal block.

### Edge Case #11: Impulse Kick Hazards
**Current State:**
- `fireInitialImpulse` in `impulse.ts` is called once if `!hasFiredImpulse` and `lifecycle < 0.1`.
- **Reset Trigger:** `resetLifecycle()` sets `hasFiredImpulse = false`.
- **Problem:** If `resetLifecycle()` is called accidentally (e.g. erratic `useEffect` or hot reload), the kick re-fires. If it fires during a drag, it might fight the user.
- **Fix:**
    1.  Add strict cooldown (e.g. `lastImpulseTime`).
    2.  Guard against `draggedNodeId !== null`.
    3.  Gate by `energy` (only kick if energy is high/chaotic? Or low? Actually usually at start).

### Edge Case #12: De-Locking Leak
**Current State:**
- `applyDenseCoreVelocityDeLocking` checks `isEarlyExpansion(energy)`.
- It reduces parallel velocity by 20% compared to neighbors.
- **Problem:** It effectively "cools" relative motion, but if run constantly, it acts as a non-conservative force that could cause drift.
- **Missing Gate:** No check for "Stagnation". It runs purely on density + energy.
- **Fix:** Add `stagnation` metric (low displacement over N frames) as a gate. Only de-lock if actually locked.

## 2. Proposed Fixes

### Fix #10: Fatal Containment
- Modify `engine.ts`: Inside `if (fatal)`, call `applyBoundaryForce`.
- Ensure it uses the cheapest possible check (box bounds).

### Fix #11: Guarded Kick
- Modify `engine.ts`:
    - Add `impulseCooldown: number`.
    - Function `requestImpulse()` checks cooldown and drag state.
    - `fireInitialImpulse` calls `requestImpulse`.

### Fix #12: Gated De-Locking
- Modify `velocity/denseCoreVelocityUnlock.ts`:
    - Add `isStagnant` check (requires tracking node displacement history or minimal velocity).
    - Or simpler: only apply if `energy > threshold` AND `velocity < small_E`?
    - Actually, user request says "Gate de-locking tightly: only apply when system is truly stuck".
    - Stagnation detector: `avgSpeed < X` for `time > Y`.

## 3. Instrumentation Plan
- **Fatal:** Log "Fatal Mode Active - Containment ON".
- **Kick:** Log "Kick REJECTED (Reason: Cooldown/Drag)".
- **Delock:** Log "Delock Triggered (Stagnation)".

## 4. Implementation Results (Completed)

### Fix #10: Fatal Containment
- **Restored:** `applyBoundaryForce` is now explicitly called inside the `if (fatal)` block in `engine.ts`.
- **Result:** Nodes no longer drift off-screen when the engine is throttled to fatal mode.

### Fix #11: Guarded Impulse Kick
- **Guard:** Kick now routes through `requestImpulse()`.
- **Cooldown:** Fails if `now - lastImpulseTime < 1000ms`.
- **Drag Check:** Fails if user is currently dragging a node.
- **Timestamp:** Logging now includes `t=...` for better debugging.

### Fix #12: Gated De-Locking
- **Stagnation Gate:** In `denseCoreVelocityUnlock.ts`, we now check if `avgVMag > 2.0`.
- **Result:** De-locking only occurs when the local group is moving very slowly (stagnant/jammed), preventing energy leaks during free motion.

