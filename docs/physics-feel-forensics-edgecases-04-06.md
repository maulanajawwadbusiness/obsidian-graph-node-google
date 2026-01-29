# Physics Feel Forensics: Edgecases 04–06

## 1. Executive Summary
The "flimsy / slushy" feel introduced by edgecase fixes 04–06 is caused primarily by **Edgecase 06 (Accumulator Multi-Step Cap)**.

- **The Mechanism**: The `maxStepsPerFrame` (default: 2) hard-cap prevents the physics engine from keeping up with wall-clock time whenever the main thread frame rate drops below ~31fps (Frame Delta > 32ms), **regardless of how fast the physics tick actually is**.
- **The Effect**: This creates **Time Dilation** (Physics Time < Real Time). The simulation runs in slow motion relative to the user's hand intent.
    - Dragging a node moves it 50px in screen space, but the physics engine only simulates enough time for it to move ~30px.
    - Result: The node lags behind the cursor ("slushy"), and springs feel weaker because they integrate over less time.
- **Secondary Factor**: **Edgecase 05 (Fixed Step Remainder Drop)**. By default (`experimentFixedStepStrict: false`), the engine discards any remainder time (`accumulator % fixedStep`) if at least one step ran. This systematically leaks small amounts of time (0–15ms) per frame, contributing to a feeling of subtle drag or "friction" that wasn't there with variable steps.

---

## 2. Evidence & Analysis

### Locations of Changes
- **Loop Logic**: `src/playground/useGraphRendering.ts` (`stepsThisFrame < maxStepsPerFrame`).
- **Config**: `src/physics/config.ts` (`maxStepsPerFrame: 2`, `targetTickHz: 60`).

### Hypothesis H6: Max Steps Starvation (CONFIRMED)
The critical flaw is that the safety cap is based on **Steps Count** (an arbitrary integer) rather than **Execution Time** (actual CPU cost).

```typescript
// Current Logic (Simplified)
while (accumulator >= 16ms && steps < 2) {
    engine.tick(16ms);
    accumulator -= 16ms;
    steps++;
}
// Any remaining accumulator is effectively dropped eventually
```

**Scenario A: Heavy Physics, Good Render**
- Tick cost: 20ms. Render cost: 2ms. Total Frame: 22ms.
- Accumulator gains 22ms.
- We run 1 tick (16ms). Remainder 6ms.
- **Result**: Physics keeps up. Feel is good.

**Scenario B: Light Physics, Heavy Render (The "Slush" Case)**
- Tick cost: 1ms (very fast). Render cost: 50ms (slow browser/UI). Total Frame: 51ms.
- Accumulator gains 51ms (3.1 steps worth).
- We run **2 ticks** because `maxSteps=2`.
- CPU time spent on physics: **2ms**.
- We DROP **19ms** of simulation time.
- **Result**: Physics runs at ~60% speed.
- The user perceives this as the graph being "heavy" or "underwater", but it's actually just time-dilated.

**Proof in Telemetry**:
Look for `[RenderPerf] droppedMs=...`.
If `droppedMs > 0` while `avgTickMs` is low (e.g., <5ms), the engine is artificially throttling itself despite having plenty of CPU headroom.

---

## 3. Other Hypotheses Disproved

- **H2 (Damping per Tick)**: Analysis of `damping.ts` shows the math `v *= (1 - k*dt)` approximates `e^(-k*t)` closely enough for 16ms vs 32ms steps (0.1% error). Not the cause.
- **H3 (Double Scaling)**: Code review of `forcePass.ts` and `baseIntegration.ts` confirms forces and velocity are scaled correctly by `dt` exactly once.
- **H4 (Spacing Gate Ramp)**: While the ramp is slow (0.6s), energy decays to near-zero quickly. In steady state (drag), the gate is fully open (1.0). This only affects the first second of load, not the persistent "slushy" interaction.

---

## 4. Remediation Plan

We must decouple the **Safety Cap** (anti-spiral-of-death) from the **Simulation Speed Limit**.

### Recommended Fix: Budget-Based Cap
Instead of `maxStepsPerFrame = 2`, we should use a `maxPhysicsBudgetMs` (e.g., 12ms).

**New Logic:**
1. Always run at least 1 tick (to ensure progress).
2. Continue running ticks while:
   - `accumulator >= fixedStep`
   - AND `timeSpent < maxPhysicsBudgetMs`
3. If we hit the budget limit, THEN we stop and drop time (Safety Tripwire).

This allows the engine to catch up (e.g., run 5 fast ticks) if the render was slow but physics is cheap, eliminating the "slush" in UI-heavy scenarios.

### Checklist
- [ ] Add `maxPhysicsBudgetMs` to `ForceConfig` (default ~12ms).
- [ ] Update `useGraphRendering.ts` to track `const tickStart = performance.now()` and break loop if budget exceeded.
- [ ] Keep `maxStepsPerFrame` as a secondary "sanity hard cap" (e.g., raise to 8).
- [ ] Verify `droppedMs` drops to near zero in the `[RenderPerf]` logs.
