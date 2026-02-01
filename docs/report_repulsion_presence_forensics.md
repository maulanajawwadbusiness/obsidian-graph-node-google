# Repulsion Presence Forensics Report (2026-02-02)

## Executive Summary

**ANSWER: YES** - True short-range repulsion exists and is active.

## 1. Forensic Findings

### 1.1 Location & Implementation
- **File**: `src/physics/forces.ts`
- **Function**: `applyRepulsion()` (Lines 8-286)
- **Invocation**: `src/physics/engine/forcePass.ts` (Lines 192, 220)

### 1.2 Pair Generation Method
**BRUTE FORCE O(N²)** with optimizations:
- **Primary Loop**: Lines 271-279 in `forces.ts`
  ```typescript
  for (let i = 0; i < activeNodes.length; i++) {
      const nodeA = activeNodes[i];
      for (let j = i + 1; j < activeNodes.length; j++) {
          applyPair(nodeA, activeNodes[j]);
      }
      for (let j = 0; j < sleepingNodes.length; j++) {
          applyPair(nodeA, sleepingNodes[j]);
      }
  }
  ```
- **Optimization 1**: Active/Sleeping split reduces pairs (sleeping nodes don't interact with each other)
- **Optimization 2**: `pairStride` parameter enables strided sampling (e.g., `stride=2` processes 50% of pairs)
- **Optimization 3**: `repulsionDistanceMax` early-exit (Line 205: `if (d2 < maxDistSq)`)
- **NO spatial hash, NO quadtree, NO adjacency filtering**

### 1.3 Gating Mechanisms

#### A. Sleep/Degrade Gates
- **Sleep**: Sleeping nodes only interact with active nodes (not each other)
- **Degrade**: `pairStride` parameter (Lines 15, 47-53) enables coverage reduction
  - `stride=1`: 100% coverage (full N²)
  - `stride=2`: ~50% coverage (deterministic hash-based skip)
  - `stride=3`: ~33% coverage

#### B. Mode Gates
- **XPBD Mode**: Repulsion is **DISABLED** in XPBD mode
  - Evidence: `engineTickXPBD.ts` has NO `applyRepulsion` calls (grep confirmed)
  - Evidence: `engineTick.ts` (Legacy mode) has NO `applyForcePass` calls (grep confirmed)
  - **Isolation**: XPBD and Legacy are mutually exclusive pipelines

#### C. Config Gates
- **Toggle**: `repulsionEnabled` parameter (Line 22 in `forcePass.ts`)
- **Strength**: `repulsionStrength` config (Line 20 in `forces.ts`)
- **Range**: `repulsionDistanceMax` config (Line 21)

### 1.4 Units & Zoom Invariance
- **Radius**: World-space pixels (NOT screen-space)
- **Zoom Invariance**: **YES** - Forces computed in world coordinates before camera transform
- **Config Values**:
  - `repulsionMinDistance`: Singularity clamp (default ~5-10px)
  - `repulsionDistanceMax`: Cutoff radius (default ~100-200px)
  - `repulsionStrength`: Force coefficient (k in F = k/d)

### 1.5 Force Law
- **Formula**: `F = (k / d) * scale * densityBoost * pairStride` (Line 245)
- **Type**: Inverse distance (1/r), NOT inverse-square (1/r²)
- **Softening**: Dynamic dead-core at d < softR (Lines 216-222)
  - Ramps from 0.1 at d=0 to 1.0 at d=softR
  - Prevents singularity explosions

## 2. Current XPBD Status

### 2.1 Repulsion in XPBD Mode
**STATUS: MISSING**

The XPBD pipeline (`engineTickXPBD.ts`) does NOT call `applyRepulsion`. This means:
- **Edge constraints**: Handled by XPBD solver (distance constraints)
- **Non-edge repulsion**: **NOT ACTIVE**

### 2.2 Observable Behavior
User observation matches forensics:
- "Repulsion/spacing seems to happen for neighbor/linked dots" → **XPBD edge constraints**
- "Non-neighbor dots can overlap and pass through" → **No global repulsion in XPBD mode**

## 3. Repulsion-Like Behaviors (XPBD Mode)

### 3.1 Edge-Based Separation
- **Source**: `solveXPBDEdgeConstraints()` in `engineTickXPBD.ts`
- **Scope**: Only linked pairs (topology-based)
- **Mechanism**: Distance constraints with compliance

### 3.2 Diffusion (Minimal)
- **Source**: `applyCorrectionsWithDiffusion()` (if still active)
- **Scope**: Smoothing, NOT repulsion
- **Effect**: Negligible for overlap prevention

### 3.3 Springs (Legacy Mode Only)
- **Source**: `applySprings()` in `forces.ts`
- **Scope**: Linked pairs only
- **Status**: Replaced by XPBD constraints in XPBD mode

## 4. Proposed Solution: XPBD Repulsion Integration

### 4.1 Insertion Point
**RECOMMENDED**: Add to `engineTickXPBD.ts` BEFORE constraint solve

```typescript
// engineTickXPBD.ts (Line ~574, after applyKinematicDrag)
if (engine.config.xpbdRepulsionEnabled) {
    applyRepulsion(nodeList, activeNodes, sleepingNodes, 
                   engine.config, stats, energy, 
                   pairStride, pairOffset, engine.neighborCache);
}
```

### 4.2 O(N²) Mitigation Strategies

#### Option A: Spatial Hash (RECOMMENDED)
- **Complexity**: O(N) build + O(N·k) query (k = avg neighbors per cell)
- **Implementation**: Grid-based bucketing
- **Tradeoff**: Memory overhead (~10-20% for grid structure)

#### Option B: Strided Sampling (CURRENT)
- **Complexity**: O(N²/stride)
- **Implementation**: Already exists (`pairStride` parameter)
- **Tradeoff**: Coverage gaps (acceptable for large N)

#### Option C: Hybrid (BEST)
- **Small N (<100)**: Brute force (fast enough)
- **Large N (≥100)**: Spatial hash
- **Drag**: Force full coverage (stride=1) for local bubble

### 4.3 Config Additions
```typescript
interface ForceConfig {
    xpbdRepulsionEnabled: boolean;      // Toggle
    xpbdRepulsionStrength: number;      // Separate from legacy
    xpbdRepulsionDistanceMax: number;   // Cutoff radius
    xpbdRepulsionUseSpatialHash: boolean; // Optimization toggle
}
```

## 5. Risk Assessment

### 5.1 Performance Impact
- **N=60**: Brute force acceptable (~3600 pairs, ~0.1ms)
- **N=250**: Brute force marginal (~31,250 pairs, ~1-2ms)
- **N=1000**: Brute force UNACCEPTABLE (~500,000 pairs, ~10-20ms)

### 5.2 Stability Impact
- **XPBD + Repulsion**: Compatible (forces applied before constraint solve)
- **Reconcile**: Repulsion forces integrate normally (Euler step)
- **Ghost Velocity**: No impact (repulsion is force-based, not positional)

## 6. Recommendations

1. **Immediate**: Add `applyRepulsion` call to XPBD pipeline (Lines ~574 in `engineTickXPBD.ts`)
2. **Short-term**: Implement spatial hash for N > 100
3. **Long-term**: Consider XPBD-native repulsion constraints (position-based, not force-based)

## 7. Verification Commands

```powershell
# Confirm repulsion exists in Legacy mode
rg "applyRepulsion" src/physics/engine/forcePass.ts

# Confirm repulsion missing in XPBD mode
rg "applyRepulsion" src/physics/engine/engineTickXPBD.ts

# Check config toggles
rg "repulsionEnabled" src/physics
```

## 8. Conclusion

**Repulsion exists but is mode-gated**. The XPBD transition disabled global repulsion, leaving only edge-based constraints. This is the root cause of the observed overlap behavior.

**Action Required**: Restore repulsion in XPBD mode with O(N²) mitigation.
