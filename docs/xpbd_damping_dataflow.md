# XPBD Damping Dataflow & Wiring

**Date**: 2026-02-02
**Status**: Verified Robust

## Overview
This document describes the end-to-end flow of the `xpbdDamping` configuration parameter, from the UI button to the mathematical application in the physics engine.

## Dataflow

1.  **UI Interaction (`GraphPhysicsPlayground.tsx`)**
    -   User clicks preset (SNAPPY / BALANCED / SMOOTH).
    -   `handleXpbdDampingPreset` is called.
    -   **Action**: Calls `engine.applyXpbdDampingPreset(preset)`.
    -   **Sync**: Updates local React state (`config.xpbdDamping`) for visual label update.

2.  **Engine Dispatch (`engine.ts`)**
    -   `applyXpbdDampingPreset(preset)` runs.
    -   Maps preset name to numeric value (e.g., SNAPPY -> 0.12).
    -   Calls `this.updateConfig({ xpbdDamping: value })`.

3.  **Config Merge (`engineTopology.ts`)**
    -   `updateEngineConfig(engine, newConfig)` runs.
    -   Merges new config into `engine.config` via spread op: `{ ...engine.config, ...newConfig }`.
    -   **Safety**: `ForceConfig` type definition ensures `xpbdDamping` is a valid key.
    -   **Assertion**: Dev-mode check ensures key is not dropped.

4.  **Physics Tick (`engineTickXPBD.ts`)**
    -   Loop runs.
    -   Reads `rawDamping = engine.config.xpbdDamping ?? DEFAULT`.
    -   Clamps to `effectiveDamping` [0, 2].
    -   **Guard**: Checks for rapid fluctuations (<500ms revert) and warns if detected.

5.  **Integration (`integration.ts`)**
    -   Called by `engineTickXPBD`.
    -   Receives `effectiveDamping`.
    -   Passes it to `applyDamping`.

6.  **Mathematical Application (`velocity/damping.ts`)**
    -   `applyDamping` runs.
    -   Applies exponential decay: `vx *= exp(-effectiveDamping * 5.0 * dt)`.
    -   **Legacy Interference**: Legacy V-Mods are gated by `!useXPBD`, ensuring no conflict.

## Safeguards
-   **Revert Guard**: `engineTickXPBD` logs a warning if `xpbdDamping` flips back to a previous value within 500ms (detects fight with defaults).
-   **No-Legacy**: Sidebar UI does not generate sliders for `xpbdDamping`, preventing accidental overwrite.
