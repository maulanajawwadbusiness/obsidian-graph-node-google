# XPBD Run 1: Mini Run 3 - Inventory & Rest Policy

## Goal
Implement the **Edge Constraint Inventory** and a deterministic **Rest-Length Policy** ("Spawn is Neutral"). Wire this real inventory into the telemetry to prove that constraints are being tracked accurately without simulation placeholders.

## Changes

### 1. Data Model
-   **Structure**: Added `XPBDConstraint` (nodeA, nodeB, restLen, compliance, lambda) to `engineTickTypes.ts`.
-   **Context**: Added `xpbdConstraints[]` and `xpbdConstraintsDirty` flag to `PhysicsEngine` and `PhysicsEngineTickContext`.
-   **Stats**: Added `xpbdConstraintStats` (min/max/avg rest length) for verification.

### 2. Topology Tracing
-   Updated `addLinkToEngine` and `clearEngineState` in `engineTopology.ts` to set `xpbdConstraintsDirty = true`.
-   **Fix**: Correctly updated `PhysicsEngineTopologyContext` type definition to include XPBD fields.
-   **Fix**: `clearEngineState` now explicitly resets `xpbdConstraintStats` to prevent stale HUD data on reset.
-   This ensures the inventory is rebuilt *only* when the graph connectivity changes (verified via `xpbdConstraintsDirty` check in tick).

### 3. Inventory Rebuild & Policy
-   Implemented `rebuildXPBDConstraints(engine)` in `engineTickXPBD.ts`.
-   **Structure**: Populates `dist` (current), `restLen` (target), `lambda` (0), `compliance` (0).
-   **Policy**: `RestLength = Clamp(DistanceAtSpawn, 10px, 1000px)`.
    -   This sets the spring target to the *initial* distance between nodes (neutral/zero-stress start), clamped to safe limits.
    -   Compliance is set to 0.0 (Infinite Stiffness) for now.
    -   Lambda is initialized to 0.

### 4. Telemetry Update (Real Data)
-   Removed simulated/fake `iter` and `err/corr` accumulation from `applyXPBDEdgeConstraintsStub`.
-   `xpbdSpringConstraints` now reports `xpbdConstraints.length` (the REAL count).
-   `xpbdSpringSolved`, `errAvg`, `corrMax` return to 0 (correctly reflecting "no solver math yet").
-   Added **Rest Length Stats**: `rest: Min-Max (Avg)` to the HUD.

## Verification

### Manual Check
1.  **Launch** app.
    -   HUD "XPBD Springs" -> `constraints: [N]`.
    -   `rest`: Should show reasonable values (e.g. `10-200 (μ=120)`).
    -   `solved`: 0 (Correct).
    -   `errAvg`: 0 (Correct).
2.  **Spawn Nodes**:
    -   `constraints` updates immediately.
    -   `rest` stats update and stay stable (deterministic).

## Next Steps
Proceed to **Mini Run 4**: Implement the Distance Constraint Solver (Distance Constraint Math) to make `solved`, `errAvg`, and `corrMax` come alive with real physics.
