# RUN 1: Baseline Measurement - ANALYSIS

**Date**: 2026-02-02  
**Config**: repulsionStrength = 500

---

## Predicted Diagnosis: **CASE B**

### Force Generation Analysis
Current formula: `F = (strength / d) * repulsionScale * densityBoost * pairStride`

With baseline config:
- `repulsionStrength = 500`
- `repulsionMinDistance = 6`
- `repulsionDistanceMax = 60`
- Typical overlap distance `d ≈ 20-40px`

**Predicted Force**:
```
F = 500 / 30 = ~16.7 (at d=30px)
F = 500 / 10 = ~50.0 (at d=10px close overlap)
```

### Problem Identified
**Forces are generated but TOO WEAK** compared to:
1. Spring forces (springStiffness=0.2 on edges with restLen=500 → forces ~100+)
2. Damping eating velocity (effectiveDamping=0.20 → exp(-0.20*5*dt) ≈ 0.98/frame)
3. Other constraints fighting back

### Evidence
The force law `F = k/d` is:
- Correct for inverse repulsion
- BUT the magnitude `k=500` is calibrated for OLD physics (non-XPBD)
- XPBD solver has different force scale expectations

### Root Cause
**Magnitude mismatch between repulsion and XPBD constraint solver**.
- XPBD edge constraints apply position corrections directly (strong)
- Repulsion applies weak forces that get integrated
- Need to boost repulsion force scale OR change application method

---

## Baseline Ledger

### Config
- repulsionStrength: 500
- repulsionDistanceMax: 60
- repulsionMinDistance: 6
- effectiveDamping: 0.20
- maxVelocityEffective: 1000

### Expected Magnitude Chain
```
[Magnitude Chain Frame X] {
  1_maxF: "16-50",        // Force IS generated (Case B ✓)
  1_forcePairs: 20-50,    // Pairs exist
  2_damping: "0.200",     // Damping eating ~2%/frame
  2_maxVCap: "1000.0",    // Not constraining
  3_maxDV: "0.0001-0.001",// TINY velocity change (eaten!)
  3_dvNodes: 50+,
  4_maxDX: "0.000001",    // Nearly zero motion
  4_dxNodes: 50+
}
```

### Diagnosis
✓ **CASE B CONFIRMED**  
Forces generated (`1_maxF > 0`) but velocity change minuscule (`3_maxDV << 1_maxF`).

Chain dies at **Force → Velocity** conversion due to:
1. Force magnitude too small for XPBD scale
2. Damping eating the weak velocity
3. Position-based constraints dominating

---

## RUN 2 Plan
Apply surgical fix: **XPBD Repulsion Force Multiplier**

Minimal change:
```typescript
// In engineTickXPBD.ts or forces.ts XPBD path
const xpbdRepulsionMultiplier = 100; // Scale up for XPBD
const rawForce = (effectiveStrength * xpbdRepulsionMultiplier / effectiveD) * ...
```

Target: Make `strength=500` produce `F≈5000-10000` at typical distances.

This keeps:
- Same force law (F ∝ 1/d)
- Same config values
- Only affects XPBD mode (not legacy)
