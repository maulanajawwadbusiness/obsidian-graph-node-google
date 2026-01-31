# Constraint Fight HUD Fix Report

## Overview
This report details the fixes applied to resolve the missing constraint fight forensics and advanced toggles in the Graph Playground.

## Changes Applied

### 1. Data Plumbing (`metrics.ts`)
**File**: `src/playground/rendering/metrics.ts`
**Change**: Updated `createMetricsTracker` to copy ledger data from logic-layer to render-layer.
```typescript
// BEFORE
setMetrics({ ... renderDebug: getRenderDebug() ... })

// AFTER
const debugStats = engine.getDebugStats();
if (renderDebugBase && debugStats) {
    renderDebug = {
        ...renderDebugBase,
        energyLedger: debugStats.energyLedger,
        fightLedger: debugStats.fightLedger
    };
}
```
**Impact**: Ensures `metrics.renderDebug.energyLedger` and `metrics.renderDebug.fightLedger` are populated, allowing the UI to render them.

### 2. UI Updates (`CanvasOverlays.tsx`)
**File**: `src/playground/components/CanvasOverlays.tsx`
**Change**: 
- Fixed a syntax error (stray `</div>`) that may have broken the component tree.
- Reinforced the "Constraint Fight Ledger" block with correct null checks.
- Added a **Version Indicator** to the debug panel:
  `HUD v1.1 (fight-ledger enabled)`
**Impact**: Verifies that the new code is deployed and running.

### 3. Type Safety (`renderingTypes.ts`)
**File**: `src/playground/rendering/renderingTypes.ts`
**Change**: Added `energyLedger` and `fightLedger` to the `RenderDebugInfo` type definition.
**Impact**: Prevents TypeScript errors and ensures correct data shape.

## Verification Steps
1.  Open the **Debug Panel** (click explicit "Debug" button or hotkey).
2.  Enable **"Show Advanced Physics Toggles"**.
    *   *Verify*: "No Constraints" / "No Reconcile" toggles appear.
3.  Check the top-left of the panel (under "Time").
    *   *Verify*: Text reads **HUD v1.1 (fight-ledger enabled)**.
4.  Run the simulation.
    *   *Verify*: **Energy Ledger** and **Constraint Fight Ledger** tables appear at the bottom of the visible HUD.
