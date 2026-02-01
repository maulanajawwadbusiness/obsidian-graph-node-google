# Forensic Report: `node.x/y` Write Ownership (Refined)

**Date:** 2026-02-01
**Target:** `PhysicsNode.x` and `PhysicsNode.y` (Canonical Position Fields)

## 1. The Canonical Reader (Renderer)
The renderer reads directly from the `PhysicsNode` instances located in `engine.nodes`. There is no intermediate "render buffer" or double-buffering for positions.

-   **File:** `src/playground/rendering/graphDraw.ts`
-   **Function:** `drawNodes`
-   **Read Location:**
    ```typescript
    // src/playground/rendering/graphDraw.ts
    // Fix 42: Manual Projection & Scaling
    let screen = worldToScreen(node.x, node.y);
    ```
-   **Implication:** Whatever value is in `node.x` at the moment `drawNodes` is called (in the `requestAnimationFrame` loop) is what gets drawn.

## 2. The Physics Write Timeline (Tick Order)
The physics tick (`engineTick.ts`) runs at 60Hz deterministic. The write order within a single tick is:

| Stage | Writer Function | File + Anchor | Impact on `node.x/y` | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **0. Rebase** | `runPhysicsTick` (Inline) | `engineTick.ts` `if (maxPos > 50000)` | **Direct Write** (`n.x -= cx`) | **Hidden Writer.** Shifts entire world to preserve float precision. |
| **1. Forces** | `applyForcePass` | `forcePass.ts` `node.fx += ...` | `node.fx/fy` only | Accumulates forces. `node.x/y` NOT touched. |
| **2. Velocity** | `applyDragVelocity` | `velocityPass.ts` | `node.vx/vy` only | Updates velocity. |
| **3. Integration** | `integrateNodes` | `integration.ts` `node.x += node.vx * dt` | **Primary Mover** | Moves nodes based on velocity. |
| **4. Constraints** | `applySpacing` | `constraints.ts` | `correctionAccum` | buffered. NO direct mutation (except buffer). |
| **5. Correction** | `applyCorrectionsWithDiffusion` | `corrections.ts` `node.x += selfDx` | **Direct Write** | **Final Physics Writer.** Applies PBD + Diffusion. |
| **6. Finalize** | `finalizePhysicsTick` | `engineTickFinalize.ts` | No | Reads `node.x` to update `lastGoodX`. |

## 3. The "After-Tick" Writers (Hidden / Vibe Killers)
These run *after* `engine.tick()` but *before* `drawNodes()`, inside the main render loop.

| Writer | Function | File + Anchor | Impact | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Drag Sync** | `applyDragTargetSync` | `graphRenderingLoop.ts` `dragged.x = engine.dragTarget.x` | **Overwrites** | **High**. Replaces physics position with mouse pos immediately before draw. |
| **Drop Debt** | `runPhysicsScheduler` | `renderLoopScheduler.ts` | None | Drops time (debt), doesn't mutate positions. |

## 4. Drag Lifecycle Ownership
The drag interaction splits ownership between Physics (Force) and Renderer (Sync).

- **Pointer Down**:
    - `hoverController.ts` -> `updateHoverSelection` detects node.
    - `graphRenderingLoop.ts` calls `engine.grabNode(nodeId, {x,y})`.
    - `engine.ts` sets `draggedNodeId` and `dragTarget`.
- **Pointer Move**:
    - `hoverController.ts` updates `cursorClientX/Y`.
    - `graphRenderingLoop.ts`: `startGraphRenderLoop` -> calls `applyDragTargetSync` each frame.
    - `applyDragTargetSync` updates `engine.dragTarget`.
    - **Conflict**: `forcePass.ts` *also* applies a spring force (`node.fx += dx * dragStrength`) toward `dragTarget`.
    - **Resolution**: `applyDragTargetSync` (Render Loop) overwrites `node.x/y` just before draw, effectively making the force irrelevant for the *dragged* node's position, but the force *does* affect velocity (`vx/vy`) which might be used for throw/release.
- **Pointer Up**:
    - `hoverController.ts` -> `handlePointerUp` -> `clearHover`.
    - `engine.releaseNode()` clears `draggedNodeId`.
    - Node resumes normal physics; `node.vx/vy` accumulated during drag (via force) dictates "throw".

## 5. XPBD Injection Point
Decision: **Option B (After Corrections)**.

-   **Location**: `src/physics/engine/engineTick.ts`, immediately after `applyCorrectionsWithDiffusion`.
-   **Why**:
    -   Must run *after* integration (to act on predicted position).
    -   Must run *after* standard PBD (if we keep it) or *replace* standard PBD.
    -   If we place it *before* `finalizePhysicsTick`, it is the final authority on Position.
    -   It is safe from `correctionAccum` fighting because XPBD solves sequentially or iteratively, writing to `node.x/y` directly (or a buffer if utilizing Gauss-Seidel).

**Safest Injection**:
```typescript
// engineTick.ts
// ... existing corrections ...
if (xpbdEnabled) {
    applyXPBDConstraints(engine, nodeList, dt);
}
// ... finalize ...
```

## 6. Risk List
1.  **Centroid Rebase**: XPBD internal state (prevX) must be shifted if `engine.rebaseCount` increments.
2.  **Drag Overwrite**: `applyDragTargetSync` will clobber XPBD scaling/constraints on the dragged node. XPBD must treat dragged node as infinite mass (`invMass = 0`).
