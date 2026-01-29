# Forensic Report: Physics Performance & Optimization (2026-01-29)

## 1. Executive Summary
The Arnvoid Physics Engine is **Algorithmically Expensive (O(N²))** but **Practically Optimized** for small-to-medium datasets (N < 500). It relies on modern JavaScript engine optimizations (V8/SpiderMonkey) handling raw loop iterations rather than complex spatial partitioning structures (Quadtrees/Grids).

## 2. The Frame Budget (How Time is Taken)

### A. The Render Loop (`useGraphRendering.ts`)
-   **Mechanism**: `requestAnimationFrame` driving a while-true loop.
-   **Delta Time (`dt`)**: Calculated as `(now - lastTime) / 1000`.
-   **Safety Clamp**: `dt` is strictly clamped to `0.1s` (100ms).
    -   *Forensic Note*: This prevents the "Spiral of Death". If a frame takes 500ms to compute, the physics engine only simulates 100ms. The simulation "slows down" in real-time rather than freezing the browser by trying to catch up.

### B. Garbage Collection Pressure
-   **Low**: The engine reuses `Map` objects (`nodes`, `links`) and modifies properties (`x, y, fx, fy`) in place.
-   **Leak**: `Array.from(this.nodes.values())` is called **every tick** (`engine.ts:225`). For 500 nodes, this allocates a new 500-item array 60 times a second. While minor, this is the primary source of per-frame GC pressure.

## 3. Algorithmic Complexity (Bottlenecks)

The engine employs a **Brute Force** approach for spatial interactions.

| System | Algorithm | Complexity | Notes |
| :--- | :--- | :--- | :--- |
| **Repulsion** | Nested Loop | **O(N²)** | Checks every node against every other node. |
| **Collision** | Nested Loop | **O(N²)** | Checks every node against every other node. |
| **Spacing** | Nested Loop | **O(N²)** | Checks every node against every other node. |
| **Springs** | Edge List | **O(E)** | Linear with edges. Very fast. |

### Why this works:
At N=200, N² = 40,000 checks. Modern CPUs handle this in sub-millisecond time.
At N=2000, N² = 4,000,000 checks. **This is the hard limit.** The engine will frame-drop significantly beyond 500-800 nodes.

## 4. Optimization Mechanisms (How Performance is "Reduced")

Since the engine essentially "wastes" cycles on N² checks, how does it maintain 60FPS?

### A. Energy Gating (The "Startup Turbo")
**Location**: `constraints.ts:104`
-   **Logic**: `if (energy <= 0.7)`
-   **Impact**: Even though Spacing is O(N²), it is **completely disabled** during the first ~2 seconds of the lifecycle (when energy is high).
-   **Result**: The expensive start-up explosion runs fast because the heaviest math is turned off until things settle.

### B. Distance Gating (Early Exit)
**Location**: `forces.ts:58`
-   **Logic**: `if (d2 < maxDistSq)`
-   **Impact**: While the loop visits O(N²) pairs, the expensive square root and force division only run for immediate neighbors (<60px).
-   **Cost**: The distance check (`dx*dx + dy*dy`) still runs for everyone.

### C. Sleep Threshold (False Optimization)
**Location**: `engine.ts:174`
-   **Logic**: `if (velSq < threshSq) { vx=0; vy=0; }`
-   **Forensic Note**: This is a visual stabilizer, **not a performance optimization**. "Sleeping" nodes are still iterated over, still checked for repulsion, and still collision-checked. They just don't add `vx` to `x`. It saves 0% CPU on the N² bottlenecks.

## 5. Conclusion
The engine trades **Scalability** for **Simplicity**.
-   **Pros**: Zero overhead for spatial data structure maintenance (no Quadtree rebuilding). Code is extremely readable.
-   **Cons**: Quadratic falloff. 2x nodes = 4x CPU usage.
-   **Verdict**: Perfect for "Paper Essence" (5-50 nodes). Acceptable for "Clusters" (100-300 nodes). Fatal for "Big Data" (1000+ nodes).
