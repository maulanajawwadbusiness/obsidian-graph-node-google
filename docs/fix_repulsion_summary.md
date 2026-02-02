# XPBD Repulsion Execution Fixes - Summary

**Date**: 2026-02-02  
**Scope**: Fix "repulsion never executes" class of failures (Bucket A)

## Three Root Causes Fixed

### A1: Toggle Not Real (Mini Run 1)
**Problem**: `xpbdRepulsionEnabled` was undefined by default.  
**Fix**: Added `xpbdRepulsionEnabled: true` to config defaults + HUD toggle + startup log.  
**Commit**: `0fbad6d` - "xpbd: wire xpbdRepulsionEnabled config + hud toggle"

### A2: Tick Mode Ambiguity (Mini Run 2)
**Problem**: Users couldn't verify if XPBD mode was active.  
**Fix**: Added prominent `Mode: XPBD` display in HUD (green) + mode selection log.  
**Commit**: `4d4735b` - "hud: expose tickMode + fix dispatcher wiring to match config"

### A3: Stats Reset Lifecycle (Mini Run 3)
**Problem**: Repulsion stats flickered to zero, hiding execution proof.  
**Fix**: Added lastFrame snapshots to preserve previous frame values in HUD.  
**Commit**: `e6c6261` - "hud: stabilize repulsion telemetry reset + add lastFrame snapshots"

## Verification Steps

1. **Check Console Logs**:
   - `[XPBD Repulsion] Enabled: true (default ON for dev)`
   - `[Physics Tick] Mode selected: XPBD`

2. **Check HUD**:
   - Physics Stats section shows `Mode: XPBD` in green
   - Advanced Physics section has "XPBD Repulsion" toggle (checked)
   - Repulsion Proof section shows:
     - `Enabled: YES`
     - `Called: YES` (with last frame value)
     - `Pairs: X chk / Y app` (with last frame values)
     - `MaxForce: Z` (with last frame value)

3. **Interactive Test**:
   - Drag a node close to another
   - Observe `MaxForce` and `Pairs` counters increase
   - Last frame values persist even when current frame is 0

## Files Modified

- `src/physics/config.ts` - Added default
- `src/physics/engine/engineTickTypes.ts` - Added flags
- `src/physics/engine/engineTickXPBD.ts` - Added startup log
- `src/physics/engine/engineTick.ts` - Added mode log
- `src/physics/engine/physicsHud.ts` - Added lastFrame fields
- `src/physics/engine/engineTickHud.ts` - Populated lastFrame snapshots
- `src/playground/components/CanvasOverlays.tsx` - Added toggle + mode display + lastFrame display

## Documentation

- `docs/fix_repulsion_A1_toggle_real.md`
- `docs/fix_repulsion_A2_tick_mode_proof.md`
- `docs/fix_repulsion_A3_stats_reset_lifecycle.md`

## Next Steps (Out of Scope)

These fixes addressed **execution verification**. Physics tuning (strength, distance, etc.) is a separate concern.
