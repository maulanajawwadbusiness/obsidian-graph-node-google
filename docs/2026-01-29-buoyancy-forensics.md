# Forensic Report: The Buoyancy Subsystem (2026-01-29)

## 1. Executive Summary
"Buoyancy" in Arnvoid is not a single force. It is a **layered visual illusion** created by decoupling the **Physics World** (which is heavily damped and stable) from the **Render World** (which is constantly drifting). This separation allows the graph to feel "alive" and "underwater" without compromising structural integrity.

## 2. The Bedrock: "Water Micro-Drift"
**Location**: `src/physics/engine/integration.ts`
**Concept**: "Water Touching the Underside"

The deepest layer of buoyancy is a hardcoded sine-wave overlay applied **only** to the global rotation angle. It does not affect the x/y coordinates of nodes.

```typescript
// integration.ts:48
const microDrift =
    Math.sin(t * 0.3) * 0.0008 +  // ~20s period (The Swell)
    Math.sin(t * 0.7) * 0.0004 +  // ~9s period (The Chop)
    Math.sin(t * 1.1) * 0.0002;   // ~6s period (The Ripple)
engine.globalAngle += microDrift * dt;
```

**Forensic Insight**: This creates a continuous, non-repeating "breathing" rotation. Because it affects `globalAngle`, the entire graph gently pivots around its centroid, simulating a floating object buffeted by invisible currents.

## 3. The Fluidity: Correction Diffusion
**Location**: `src/physics/engine/corrections.ts`
**Concept**: "Liquid Pressure Transfer"

When a node is pushed (by spacing or mouse drag), it doesn't just move. It "shares" 60% of that displacement with its neighbors.

*   **Mechanism**: If Node A needs to move 10px right, it moves 4px, and its neighbors allow themselves to be pushed 6px (distributed).
*   **Result**: The graph behaves like a viscous fluid or a net in water, rather than a rigid wireframe. Disturbances ripple outward, creating a "secondary motion" characteristic of buoyant objects.

## 4. The Anti-Crystal: Velocity De-locking
**Location**: `src/physics/engine/velocityPass.ts`
**Concept**: "Preventing the Ice"

Force-directed graphs tend to settle into a "Crystal State" (zero velocity, perfect equilibrium). This looks dead/frozen. Arnvoid actively fights this with `applyDenseCoreVelocityDeLocking`.

*   **Logic**: It injects microscopic velocity noise into nodes that have settled.
*   **Intent**: Maintain a "Living State" where nodes are always infinitesimally moving, preventing the eye from registering the image as static.

## 5. Conflict & Resolution
The system balances two opposing forces:

1.  **The Stabilizer (Correction Budget)**: Caps movement to `0.5px` per frame per node. This prevents the "jitter" often seen in water simulations.
2.  **The Drifter (Micro-Drift)**: Continuously rotates the canvas.

**Visual Result**: The user sees a stable structure (thanks to the Budget) that is seemingly floating in a current (thanks to the Drift). The `0.15` spin blend ensures nodes don't rigidly lock to the rotation but "drag" behind it slightly, enhancing the underwater viscous feel.

## 6. Conclusion
The "Buoyant" effect is achieved by:
1.  **High Viscosity**: Heavy damping (`0.90`) to kill oscillation.
2.  **Fake Current**: Sine-wave `globalAngle` drift.
3.  **Neighbor Drag**: Correction diffusion making connections feel soft/heavy.

It is a masterpiece of "Visual Physics" over "Real Physics".
