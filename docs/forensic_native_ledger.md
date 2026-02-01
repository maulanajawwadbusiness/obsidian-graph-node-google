# Forensic Report: Native Magnitude Ledger
**Date:** 2026-02-01
**Purpose:** Whitelist effective magnitudes so XPBD is not invisible.

## 1. Time & Integration
| Quantity | Value/Range | Variable / Config | Location | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **dt (Physics)** | `0.002` - `0.050` s | `dtUseSec` | `engineTick.ts:51` | Clamped to 50ms max. **Typical: 0.016 (60Hz)**. |
| **Hz (Target)** | `60` | `config.targetTickHz` | `types.ts` | Base for tuning. |
| **Energy** | `0.0` - `1.0` | `energy` / `motionPolicy` | `engineTick.ts` | System enters "sleep" below ~0.0004 vSq. |

## 2. Spatial Scale (Pixels)
| Quantity | Value/Range | Variable | Location | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Link Length** | `30` - `100` px | `config.linkRestLength` | `types.ts` | **30** is default base. XPBD constraints must match this. |
| **Node Radius** | `5` - `20` px | `node.radius` | `types.ts` | Visual radius. Collision often uses `radius + padding`. |
| **Collision Pad** | `5` - `15` px | `config.collisionPadding` | `types.ts` | "Personal Space". |
| **World Size** | ~`1920x1080` | `worldWidth/Height` | `engine.ts` | |

## 3. Magnitudes (Forces & Corrections)
| Quantity | Typical Range | Unit | Visibility Threshold | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Gravity Force** | `0.1` - `5.0` | `px/s^2` * `mass` | `> 0.1` | Drags slowly. |
| **Repulsion Force** | `10` - `500` | `px/s^2` * `mass` | `> 10.0` | Varies heavily with `1/d`. Singularity at d=0. |
| **Correction (PBD)**| `0.1` - `5.0` | `px / frame` | `> 0.5` | PBD projection. `0.5px` shift is visible jitter. |
| **Canary Shift** | `30.0` | `px / frame` | **Visible Jump** | Intentionally huge (`1800 px/s`). Proves ownership. |

## 4. XPBD Configuration Baseline (Proposed)
To match the "Physics Feel" of the legacy engine while using XPBD:

- **Constraint Compliance (alpha)**:
    - Hard Links: `alpha = 0`.
    - Soft Links: `alpha = 0.001` (Tune inverse to stiffness).
- **Substeps**: `1` (Legacy uses 1). XPBD might need `2-4` for stiffness, but start with `1` to match loop budget.
- **Drag**: `invMass = 0` for `draggedNodeId`.
- **Damping**:
    - Legacy: `vx *= (1 - damping * dt)`.
    - XPBD: Can use same post-solve velocity damping.
    
## 5. Visibility Verification (The Canary)
- **Active**: `config.debugXPBDCanary = true`.
- **Effect**: Node 0 teleports `+30px X`, `-20px Y` every 60 frames.
- **Observation**: If Node 0 stays still, **Render Overwrite** logic (Section 4 of Inventory) is hiding it. If it jumps, **Physics Writes** are authoritative.

## 6. HUD Validation
New counters added to `PhysicsHudSnapshot`:
- `constraintCorrectionAvg`: Monitor this. If `0`, constraints are inactive.
- `constraintCorrectionMax`: If `> 50`, explosion risk.
- `repulsionEvents`: If high, static compression.
