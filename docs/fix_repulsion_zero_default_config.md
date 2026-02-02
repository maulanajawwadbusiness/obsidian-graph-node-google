# Fix XPBD Repulsion Default: Config Logic

**Date**: 2026-02-02
**Goal**: Ensure `xpbdRepulsionEnabled` defaults to `true` in `DEFAULT_PHYSICS_CONFIG`.

## Changes

### 1. `src/physics/config.ts`
Added `xpbdRepulsionEnabled: true` to the default configuration object.
Previously, this key was missing, causing the engine to fallback to `undefined` (falsy) unless manually toggled.

## Verification
- **Load**: App should load with "XPBD Repel" checked and active.
- **HUD**: "Repulsion Proof" section should show `Enabled: YES` immediately.

## Risks
- None.
