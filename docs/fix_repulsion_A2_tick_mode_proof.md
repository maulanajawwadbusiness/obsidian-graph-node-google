# Fix Repulsion A2: Tick Mode Proof

**Date**: 2026-02-02
**Goal**: Remove ambiguity about which tick path is running and allow forcing XPBD mode.

## Changes

### 1. `src/physics/engine/engineTickHud.ts`
Updated `updateHudSnapshot` to explicitly read `engine.config.useXPBD` and populate `hud.mode` with `'XPBD'` or `'LEGACY'`.
Previously, this field might have been hardcoded or dependent on inference. Now it reflects the config source of truth.

### 2. `src/playground/components/CanvasOverlays.tsx`
- **Tick Mode Display**: Added "Mode: XPBD" (green) or "Mode: LEGACY" (grey) to the top of the "Physics Stats" block.
- **Master Toggle**: Added "Use XPBD Engine" (green) to the "Advanced Physics > XPBD FORCING" section.

## Verification
- **Visual**: The HUD now clearly states "Mode: XPBD".
- **Interaction**: Checking "Use XPBD Engine" immediately switches the mode label.
- **Telemtry**: When in XPBD mode, the "Repulsion Proof" section (from A1) should update. When in Legacy mode, it should stall (since `engineTickXPBD` is skipped).

## Risks
- Switching engine modes mid-simulation can sometimes cause energy spikes, but `engineTickXPBD` handles most state transfer.

## Next Steps (A3)
- Fix the stats reset lifecycle. Currently, even if XPBD runs, `xpbdRepulsion*` stats might be cleared too early to see.
