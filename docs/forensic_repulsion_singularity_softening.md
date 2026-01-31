# Forensic Report: Repulsion Singularity & Overlap

## 1. Repulsion Singularity ($r \to 0$)
-   **Current Handling**:
    -   If `dx=0, dy=0`: `dx = (Math.random() - 0.5) * 0.1`.
    -   **Problem**: Non-deterministic. Causes jitter at rest if nodes overlap.
-   **Force Formula**:
    -   `F = k / max(d, minDistance) * scale`.
    -   **Dead Core**: force scales down if `d < 12`.
    -   **Issue**: `12` is hardcoded. Should be relative to node size (world units).

## 2. Spacing Singularity
-   **Current Handling**:
    -   If `d < 0.1`: `return false`.
    -   **Problem**: "Giving up". If force pass fails to separate (or is disabled), spacing pass ignores the pair, leaving them trapped forever.

## 3. Collision Singularity
-   **Current Handling**:
    -   If `d=0`: `angle = random`, `force = strength * 0.1`.
    -   **Problem**: Non-deterministic.

## 4. Fix Plan
1.  **Deterministic Direction**:
    -   If `d < epsilon`:
        -   Use `(idA ^ idB)` to seed a direction.
        -   Ensure `idA < idB` ordering for consistency.
2.  **Dynamic Softening**:
    -   Replace hardcoded `12` with `config.repulsionSofteningRadius` (default to world-scale).
3.  **Gentle Overlap Resolver**:
    -   In `applySpacingConstraints`: If `d < epsilon`, apply a specific "separation projection" instead of returning.
    -   Use `maxForce` bounds to prevent explosion.
4.  **Diagnostics**:
    -   Track `minPairDist` and `nearOverlapCount`.
