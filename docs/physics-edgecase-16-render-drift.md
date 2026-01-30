# Physics Edge Case #16: Render-Space Micro-Drift

## 1. Forensic Findings
**Source:** `src/physics/engine/integration.ts` lines 44-52.
**Mechanism:**
- "Water Micro-Drift" logic applies a sum of 3 sine waves to `engine.globalAngle`.
- It executes whenever `preRollActive` is false.
- **Problem:** Even when the graph is physically stable (nodes stopped), the entire world frame rotates slowly. This creates the illusion of movement/drift, confusing users who expect stillness.

**Current Code:**
```typescript
const microDrift =
    Math.sin(t * 0.3) * 0.0008 +
    Math.sin(t * 0.7) * 0.0004 +
    Math.sin(t * 1.1) * 0.0002;
engine.globalAngle += microDrift * dt;
```

## 2. Proposed Fix
- **Config Gate:** Add `disableMicroDrift` (or `enableMicroDrift`) to `ForceConfig`. Default to keeping it enabled? No, user wants it FIXED, implying off or controllable.
- **Diagnostics:** Add a runtime toggle to the Physics Playground to disable this.
- **Deadzone:** If `disableMicroDrift` is true, force `microDrift = 0`. Also, ensure `globalAngularVel` decays to zero.

## 3. Implementation
1.  **Config:** Update `ForceConfig` interface and `DEFAULT_PHYSICS_CONFIG`.
2.  **Engine:** In `integration.ts`, check config before applying drift.
3.  **UI:** Add toggle in `CanvasOverlays` or `GraphPhysicsPlayground`.

## 4. Instrumentation
- Log `[RenderDrift] angle=...` when drift is active vs disabled.

## 5. Implementation Results (Completed)

### Fix #16: Kill-Switch for Micro-Drift
- **Config:** Added `enableMicroDrift` to `ForceConfig`, defaulting to `false` (stable).
- **Engine:** In `integration.ts`, the sine-wave drift logic is now skipped unless `enableMicroDrift` is true.
- **UI:** Added a checkbox in the Physics Playground sidebar to toggle this effect on/off for demonstration.
- **Result:** The graph is now rock-solid when settled, eliminating the perception of "phantom movement" or energy leaks, while preserving the ability to turn on the "alive" water feel if desired.

