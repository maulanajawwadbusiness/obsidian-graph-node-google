# Forensic Addendum: Repulsion & Spatial Grid (Knife-Sharp)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** BINDING SPEC

## 1. Interaction Radii Truth (The "Gap" Anomaly)
Current constants reveal a disjointed physics landscape:

| Layer | Radius | Source | Effect | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Collision Force** | ~`28 px` | `forces.ts` (rad+rad+pad) | Hard Push | **Active** (Emergency) |
| **Repulsion Force** | `60 px` | `config.repulsionDistanceMax` | Soft Push | **Active** (Layout) |
| **Hard Constraint** | `100 px` | `config.minNodeDistance` | Rigid Shell | **DORMANT** (Verified) |
| **Spring Link** | `130 px` | `config.linkRestLength` | Target Dist | Active |

**Critical Finding:** The engine currently has a "Dead Zone" between 60px and 100px.
-   Nodes are driven by Repulsion (60px).
-   They *should* be kept apart at 100px, but the Constraints are dormant.
-   **Result:** Nodes likely cluster at ~60px, violating the visual design intent of 100px.
-   **XPBD Fix:** The unified physics MUST extend effective repulsion/contact to **100px**.

**Derivation: Max Interaction Radius**
To support the 100px Hard Shell + transition slop:
-   `Hard Shell`: 100px
-   `Skin/Pad`: 8px
-   `Max Interaction`: **110 px** (Safe upper bound).

## 2. Spatial Grid Correctness
**Rule:** `cellSize` ≥ `maxInteractionRadius` to allow 3x3 queries (Center + 8 neighbors).

-   **Proposed Cell Size:** `130 px` (Matches `linkRestLength`).
-   **Query Radius:** 3x3 cells (1 cell radius).
-   **Verification:**
    -   If node is at cell edge, it sees neighbors in adjacent cell (dist < 130).
    -   Repulsion/Contact (110px) is fully contained within 3x3 of 130px cells.
    -   **Verdict:** `cellSize = 130` with **3x3 Query** is sufficient. O(1) guaranteed.

**Pseudocode: `queryCells`**
```typescript
const QUERY_OFFSETS = [
    -1, -1,  0, -1,  1, -1,
    -1,  0,  0,  0,  1,  0,
    -1,  1,  0,  1,  1,  1
]; // 9 cells

function getNeighbors(node, grid, cellSize) {
    const cx = Math.floor(node.x / cellSize);
    const cy = Math.floor(node.y / cellSize);
    const candidates = [];

    for (let i = 0; i < 18; i += 2) {
        const nx = cx + QUERY_OFFSETS[i];
        const ny = cy + QUERY_OFFSETS[i+1];
        // Spatial Hash Key: "nx:ny"
        // Int map is faster: key = (nx & 0xFFFF) | ((ny & 0xFFFF) << 16)
        const cell = grid.get(nx, ny);
        if (cell) candidates.push(...cell.nodes);
    }
    return candidates;
}
```

## 3. Determinism & Jitter Hardening
**Risk:** Cell Boundary Flicker. A node oscillating on a grid line changes its neighbor set every frame.
**Solution:**
1.  **Stable Ordering:** Grid cells store `List<NodeID>`, not `Set`. When querying, sort candidates by ID (or maintain insertion order if strictly additive).
2.  **No Random:** `forces.ts` L170 already uses deterministic ID hashing for dx=0. **Retain this.**
    -   `hash(idA + idB)` -> angle.
3.  **Hysteresis (Optional):** Strict XPBD handles jitter well. If "Contact" is rigid, nodes won't vibrate across boundaries.
4.  **Action:** Ensure `grid.add(node)` uses deterministic push (Array push is fine if iteration order of `nodeList` is stable).

## 4. Tick Placement & Write-Ownership
**Insertion Point:** `engineTick.ts`, inside the `solveConstraints` block.
**Window:**
-   **After:** `integrateNodes` (Prediction step).
-   **Before:** `finalizePhysicsTick` (Render sync).
-   **Conflict:** The current `applySpacingConstraints` writes to `correctionAccum`.
-   **Plan:** Replace `applySpacingConstraints` with `solveXPBDConstraints`.
    -   It writes DIRECTLY to `node.x/y` (XPBD style), utilizing `node.prevX/Y` for velocity derivation.
    -   **Write Proof:** `node.x` is mutable. No other system overwrites x/y in this phase. The `correctionAccum` approach (legacy) is abandoned for direct projection.

## 5. Handoff Seam (Soft vs Hard)
**Constraint:** We must not double-push (Repulsion Force + Hard Contact).
**Architecture:**
1.  **Interaction Zone:** `0 - 110 px`.
2.  **Hard Contact (XPBD):** `0 - 100 px`.
    -   Project to surface (100px).
    -   Stiffness: High (Solid).
3.  **Soft Repulsion (Force):** `60 - 120 px`.
    -   *Wait, this overlaps.*
    -   **Revised:**
        -   **Inner (0-100px):** Pure XPBD Contact (Alpha~0). Force disabled or overpowered.
        -   **Outer (100-130px):** Soft Repulsion Force (fading to 0 at 130).
    -   **Prevention of Jitter:** If Node is at 99px, XPBD pushes out. If Repulsion creates inward velocity? Unlikely. Repulsion pushes out.
    -   **Problem:** If Repulsion pushes out at 105px, and XPBD is dormant > 100px.
    -   **Seam:** The continuity is Velocity. XPBD contact handles collision response. Repulsion handles "approach".
    -   **Rule:** Repulsion Force only applied if `dist > 100`. Inside 100, XPBD takes full control. (Or Repulsion adds to energy, but XPBD resolves position).

**Constraint-Force Mixing:**
-   XPBD solves *positions*.
-   Forces add *acceleration* (velocity).
-   Correct approach: Apply Repulsion Force everywhere (0-130px). Let XPBD projection resolve the violation.
-   If repulsion is strong inside 100px, it aids XPBD.
-   **Risk:** "Pop" if repulsion is discontinuous.
-   **Binding:** Use Repulsion (smooth 1/r) everywhere. XPBD clamps the result.

**Deliverable Spec:**
-   `cellSize`: 130px.
-   `interaction`: 110px.
-   `mode`: XPBD Hard Contact (0-100px) + Background Repulsion Force.
