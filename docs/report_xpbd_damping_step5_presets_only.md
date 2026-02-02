# STEP 5/5: Presets-Only Hand Calibration

**Date**: 2026-02-02  
**Status**: ✅ COMPLETE - AWAITING USER FEEDBACK

---

## What Was Added

Minimal in-app controls for A/B testing 3 XPBD damping presets by feel.

---

## Where the Buttons Live

**File**: `src/playground/GraphPhysicsPlayground.tsx`  
**Lines**: 588-648  
**Location**: Top-left corner of canvas (black semi-transparent box)

**UI Components**:
1. **Readout**: `XPBD Damping: 0.20 (DEFAULT)` or `(CONFIG)`
2. **3 Buttons**: Snappy | Balanced | Smooth

---

## Exact Preset Values

| Preset | Value | Half-Life | Feel |
|--------|-------|-----------|------|
| **SNAPPY** | 0.12 | ~1.16s | Most responsive, quick settle |
| **BALANCED** | 0.20 | ~0.69s | Current default |
| **SMOOTH** | 0.32 | ~0.43s | Tighter, less overshoot |

**Formula**: `half-life = ln(2) / (damping * 5.0)`

---

## Hand Calibration Checklist

**Maulana**: Test each preset with these 4 scenarios. Note which preset feels best overall.

### ✅ Test 1: Tug Propagation

**Action**:
1. Spawn 15-20 nodes
2. Click a preset button
3. Drag a well-connected node through the cluster for ~1 second
4. Release

**What to observe**:
- Does the cluster body follow the drag smoothly?
- After release, does it stop cleanly within ~1-2 seconds?
- Is there excessive overshoot/oscillation?

**Good**: Cluster follows, settles decisively  
**Bad**: Cluster lags behind, or drifts slowly after release

---

### ✅ Test 2: Contact Response

**Action**:
1. Push 2 non-edge nodes into overlap (drag one into another)
2. Hold for ~0.5 seconds
3. Release

**What to observe**:
- Do they separate decisively?
- Is the separation too violent (overshoot) or too sluggish?

**Good**: Clean separation, minimal bounce  
**Bad**: Slow drift apart, or violent ping-pong

---

### ✅ Test 3: Settle After Spawn

**Action**:
1. Click a preset button
2. Spawn 15 nodes (use "Spawn" button or preset N=15)
3. Wait and observe

**What to observe**:
- Does the graph settle within ~3 seconds?
- Is there slow residual drift after apparent settle?
- Does it feel "alive" or "dead"?

**Good**: Settles within 3s, no slow drift  
**Bad**: Takes 5+ seconds, or never fully stops

---

### ✅ Test 4: Zoom Invariance

**Action**:
1. Spawn 15 nodes
2. Perform Test 1 (tug propagation) at default zoom
3. Zoom in 2x
4. Perform Test 1 again

**What to observe**:
- Does the feel change dramatically with zoom?
- Does damping strength reverse or become extreme?

**Good**: Consistent feel across zoom levels  
**Bad**: Completely different behavior at different zooms

---

## How to Test

1. **Start app**: `npm run dev`
2. **Look for UI**: Top-left corner (black box with buttons)
3. **Click preset**: Try "Snappy" first
4. **Run tests**: Perform all 4 tests above
5. **Switch preset**: Try "Balanced", repeat tests
6. **Switch preset**: Try "Smooth", repeat tests
7. **Pick winner**: Which preset felt best overall?

---

## Important Notes

### DO NOT Pick Final Default Yet

This step only adds the controls. **Do NOT change DEFAULT_XPBD_DAMPING** until maulana provides feedback.

### Current State

- **DEFAULT_XPBD_DAMPING**: Still 0.20 (unchanged)
- **Buttons**: Set `config.xpbdDamping` as override only
- **Readout**: Shows current effective value + source

### What Happens When You Click

```javascript
// Clicking "Snappy":
engine.applyXpbdDampingPreset('SNAPPY')
  → engine.updateConfig({ xpbdDamping: 0.12 })
  → Readout shows: "XPBD Damping: 0.12 (CONFIG)"
```

---

## Next Steps (AFTER User Feedback)

**STOP HERE**. Wait for maulana to reply with chosen preset.

**When maulana replies**:
1. Update `DEFAULT_XPBD_DAMPING` to chosen value
2. Remove preset buttons (or keep for future tuning)
3. Update docs with final calibrated value

---

## Commits

**RUN 1** (a91749c): Add 3 presets + apply helper  
**RUN 2** (775b462): Add minimal UI buttons + readout  
**RUN 3** (pending): This doc

---

## Question for Maulana

**Which preset feels best: Snappy, Balanced, or Smooth?**

Please test all 4 scenarios with each preset and report back. Include any notes about specific behaviors (e.g., "Snappy feels good for tug but overshoots on contact").
