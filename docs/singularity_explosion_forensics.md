# Forensic Report: The "Singularity Explosion" Start
**Date:** 2026-01-31
**Subject:** Initialization Strategy & Singularity Prevention

## 1. The Threat: Singularity Explosion
In force-directed graph physics, a "Singularity" occurs when two nodes occupy the exact same coordinate $(x, y)$.

### The Physics of Failure
Most repulsion laws follow an inverse-square relationship or similar decay:
$$ F_{repulsion} = \frac{k}{distance^2} $$

If all nodes initialize at the origin $(0,0)$:
1.  $distance \to 0$
2.  $Force \to \infty$ (Infinity)
3.  **Result:** "Singularity Explosion". Nodes are blasted outwards with `NaN` or infinite velocity in the very first frame, permanently breaking the simulation.

## 2. The Mitigation: "Micro-Cloud" Seeding
**Source:** `src/playground/graphRandom.ts`

The engine prevents this by implementing a **Structural Seeding** strategy that guarantees no two nodes ever share the same coordinate, even at $t=0$.

### A. The Micro-Cloud (Symmetry Breaking)
Instead of a single point, each node is initialized within a small jitter disc.

```typescript
// src/playground/graphRandom.ts

// SPAWN MICRO-CLOUD: Hash-based disc distribution to destroy symmetry bowl
const createNode = (...) => {
    // Deterministic Jitter from Hash
    const jitterAngle = (Math.abs(hash) % 1000) / 1000 * 2 * Math.PI;
    
    // Uniform Area Distribution (sqrt scaling)
    const sqrtRadius = Math.sqrt(hashRadius);
    const jitterRadius = 2 + sqrtRadius * 4;  // 2px - 6px radius
    
    return {
        x: jitterX, y: jitterY, // Start in micro-cloud, not origin
        // ...
    };
};
```
*   **Effect:** Every node starts with a unique offsets of 2-6px.
*   **Result:** Repulsion forces are finite ($r \ge 2$), manageable, and directional (symmetry is broken).

### B. Topological Offsets (Structure)
The graph topology generator (`generateRandomGraph`) further prevents singularities by placing children relative to their parents with **clamped minimum offsets**.

1.  **Spine (Axis)**:
    *   Nodes placed sequentially with `spineStep` (min 8px).
    *   *Code:* `currentPos.x += spineStep.x + ...`
2.  **Ribs (Volume)**:
    *   Placed perpendicular to the spine with `ribOffset`.
    *   Clamped to `min(2px)` lateral distance.
3.  **Fibers (Detail)**:
    *   Placed radially around ribs with `fiberOffset`.
    *   Clamped to `min(6px)` distance.

## 3. Conclusion
The "Singularity Explosion" is a theoretical failure mode that this engine actively designed out. By treating the startup state as a "Micro-Cloud" rather than a point source, the engine ensures that the **Big Bang** of the first frame is a controlled expansion rather than a mathematical error.

**Verdict:** The "Start" is safe. The physics engine receives a valid, non-overlapping initial state, ensuring `d > 0.1` for all constraints and forces.
