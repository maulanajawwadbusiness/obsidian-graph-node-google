# Forensic Addendum: Repulsion & Spatial Grid (Knife-Sharp Binding Spec)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** BINDING SPEC

## 1. Single Law: The "Additive" Seam
**Verdict:** **Option B (Active Everywhere)**.
Repulsion Forces and XPBD Hard Contacts run concurrently. They are **Additive**.

**The Law:**
1.  **PBD Hard Contact (Solid):** Active for $d < 100$ (Rigid Shell).
    -   Projects nodes to surface ($d = 100$).
    -   Effect: Infinite stiffness (or high alpha).
2.  **Repulsion Force (Soft):** Active for $d < 120$ (Configurable Max).
    -   Applies acceleration: $a = F/m$.
    -   Effect: Gentle bias to separate nodes *before* hard contact, and aids separation *during* contact.

**Justification:**
-   **Continuity:** Disabling repulsion inside the shell creates a localized discontinuity (Force drop-off) which can trap nodes in a "vibration well" at the boundary.
-   **Stability:** Since Repulsion pushes *outward*, it acts as a "Helper Force" for the XPBD constraint (which also projects outward). They do not fight.
-   **Seam:** The "Seam" is purely defined by range.
    -   0-100px: XPBD + Repulsion.
    -   100-120px: Repulsion Only.
    -   120px+: Zero.

## 2. Interaction Radii (One Truth)
**Formula:**
$$R_{max} = \max(R_{contact} + Slop, R_{repulsion})$$

**Derivation (Current Config):**
-   `minNodeDistance` ($R_{shell}$) = 100 px.
-   `contactSlop` = 12 px (buffer for early activation).
-   `repulsionDistanceMax` = 60 px (Legacy - **MUST BE INCREASED**).
    -   *Correction:* We bind this to `R_shell * 1.2` for effective presolving.
    -   New `repulsionDistanceMax` = 120 px.

**The Constant:**
$$R_{interaction} = \max(100 + 12, 120) = 120 \text{ px}$$

## 3. Spatial Grid Proof (General)
**Rule:**
$$N_{radius} = \lceil R_{interaction} / C_{cell} \rceil$$
$$QueryDimensions = (2 \cdot N_{radius} + 1) \times (2 \cdot N_{radius} + 1)$$

**Application:**
-   **Cell Size ($C_{cell}$):** `130 px` (Fixed, anchored to `linkRestLength`).
-   **Interaction Radius ($R_{interaction}$):** `120 px`.
-   **Calculation:**
    $$N_{radius} = \lceil 120 / 130 \rceil = 1$$
    $$Query = (2 \cdot 1 + 1)^2 = 3 \times 3 \text{ cells}$$

**Safety Margin:**
If dynamic forces push $R_{max}$ to 140px:
$$N_{radius} = \lceil 140 / 130 \rceil = 2 \rightarrow 5 \times 5 \text{ cells}$$
*Implementation Note:* The system must check `R_max` at startup. If $> 130$, switch to 5x5. For now, 3x3 is proven sufficient.

## 4. O(N²) Defense (Worst-Case Handling)
**Scenario:** "Black Hole" - all 500 nodes dragged into 1 cell.
**Naive 3x3:** $500 \times 499$ checks = 250,000 (Lag).

**Defense Strategy (Budget-Aware):**
1.  **Cap Candidates:** Max 50 neighbors per node query.
    -   If cell has > 50 nodes, sample first 50 (Stable Order) or random subset?
    -   **Decision:** First 50 (Stable). Prevents explosion, maintains Determinism.
2.  **Degradation:** If frame time > Budget (12ms):
    -   Reduce `collisionEvery` / `repulsionEvery` stride.
    -   Current engine has `earlyExit` checks.
    -   *XPBD Specific:* PBD solver cannot easily stride (instability). It MUST run.
    -   **Binding:** Constraint Solver has priority. Hard Cap of 30 neighbors for Contact Solver in "Emergency Mode".

## 5. Determinism (No Sorting)
Sorting O(N log N) per query is too slow. We achieve determinism by construction.

**Generation Rules:**
1.  **Node Order:** Iterate `activeNodes` (Array). This order is stable (insertion/lifecycle based).
2.  **Grid Pushing:**
    -   Clear Grid.
    -   Iterate `activeNodes`: `grid[cell].push(nodeID)`.
    -   Grid buckets are now strictly ordered by `activeNodes` index.
3.  **Pairing:**
    -   For `nodeA` in `activeNodes`:
    -   Query 3x3 cells.
    -   Return `neighbors` (Array of arrays). Flatten/Iterate linearly.
    -   **Filter:** `if (nodeB.id > nodeA.id)` (Canonical Pair).
    -   *Result:* Deterministic pair set, consistent every frame.

**Singularity Fallback:**
-   If `dist == 0`: Use `hash(idA, idB)` from `src/physics/forces.ts:170`.
-   **Forbidden:** `Math.random()`.

## 6. Tick Placement & Write-Ownership
**File:** `src/physics/engine/engineTick.ts`

**Sequence:**
1.  `integrateNodes(...)` -> Velocity & Position Prediction ($x' = x + v \Delta t$).
    -   *Writes:* `node.x`, `node.y`, `node.vx`, `node.vy`.
2.  **INSERT XPBD HERE (Solvers)**
    -   Replaces: `applySpacingConstraints`, `applySafetyClamp`, `applyEdgeRelaxation`.
    -   *Reads:* `node.x` (Predicted).
    -   *Writes:* `node.x` (Corrected).
    -   *Writes:* `correctionAccum` (for stats only, or removed).
3.  **Velocity Update (Symplectic Fix):**
    -   $$v_{new} = (x_{corrected} - x_{old}) / \Delta t$$
    -   *Must verify:* `integrateNodes` stores `x_old`? Currently it effectively "consumes" `x`.
    -   *Requirement:* xpbd phase needs `prevX` (position before integration) or `x_pred` (position after integration).
    -   *Binding:* We use `node.x` as $x'$. We need $x_{old}$. `node.prevX` in current engine is "Rendering Interpolation" (often).
    -   *Fix:* Check `integrateNodes`. It does `node.prevX = node.x` (L183) strictly before `node.x += v*dt`.
    -   So `node.prevX` is reliable $x_{old}$.
    -   *Velocity Rebuild:* `node.vx = (node.x - node.prevX) / dt`.

**Disabled Legacy Systems:**
-   `applySpacingConstraints` (Dormant PBD) -> **REMOVE**.
-   `applySafetyClamp` (Emergency PBD) -> **REMOVE** (Folded into XPBD Contact).
-   `applyRepulsion` (Force) -> **KEEP** (tuned to 120px range).
-   `applyCollision` (Force) -> **DISABLE** (XPBD Contact handles hard collisions).

## Binding Checklist
-   [ ] **Constants:** `R_interaction = 120px`. `cellSize = 130px`.
-   [ ] **Grid:** 3x3 Query. Stable Buckets (Insertion Order).
-   [ ] **Seam:** XPBD (0-100) + Repulsion (0-120). Additive.
-   [ ] **Cap:** Max 50 neighbors checked per node.
-   [ ] **Integration:** `node.vx = (node.x - node.prevX) / dt` post-solver.

