# Fix Repulsion A1: Toggle Real + Visible

**Date**: 2026-02-02
**Goal**: Ensure `xpbdRepulsionEnabled` is true by default and accessible in the UI.

## Changes

### 1. `src/physics/config.ts`
Added `xpbdRepulsionEnabled: true` to `DEFAULT_PHYSICS_CONFIG`.
This ensures that upon fresh load (or preset spawn), the XPBD repulsion pass is active.

### 2. `src/playground/components/CanvasOverlays.tsx`
Added a checkbox "XPBD Repel" in the "XPBD FORCING" section.
- Toggling this directly controls `config.xpbdRepulsionEnabled`.
- "Force Repel" was renamed to "Force Repel (Legacy)" to avoid confusion (this usually boosts the strength for debugging, whereas "XPBD Repel" is the enable switch).

## Verification
- **Default**: Loading the app should now show `Enabled: YES` in the "Repulsion Proof" HUD section automatically.
- **Toggle**: Unchecking "XPBD Repel" should immediately set `Enabled: NO` and stop the telemetry counters.

## Risks
- None. This just exposes the flag.
