# Forensic Report: X-Thing Node Dim Failure

**Date**: 2026-02-03  
**Issue**: X-thing nodes show 0 visual change when neighbor highlight is active  
**Expected**: X-thing nodes should dim to 20% opacity over 200ms  
**Actual**: X-thing nodes remain at 100% opacity (no dimming)

---

## Root Cause Analysis

### The Smoking Gun

**Location**: `graphDraw.ts:229`

```typescript
const renderNode = (node: any) => {
    // ... culling logic ...
    
    // Reset per-node state
    ctx.globalAlpha = 1;  // ← THIS IS THE KILLER
    ctx.globalCompositeOperation = 'source-over';
    
    // ... later at line 240-253 ...
    
    // Neighbor Highlight System: Determine if this node should be affected
    const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId ||
                          node.id === engine.draggedNodeId;
    const isNeighborNode = hoverStateRef.current.neighborNodeIds.has(node.id);
    const dimEnergy = hoverStateRef.current.dimEnergy;

    // Calculate opacity: protected nodes stay at full opacity, others dim
    let nodeOpacity = 1;
    if (dimEnergy > 0.01 && theme.neighborHighlightEnabled) {
        if (isHoveredNode || isNeighborNode) {
            nodeOpacity = 1;  // Protected from dim
        } else {
            nodeOpacity = 1 - dimEnergy * (1 - theme.neighborDimOpacity);
        }
    }
```

### The Problem

**Execution Order**:
1. Line 229: `ctx.globalAlpha = 1` (reset to full opacity)
2. Lines 240-253: Calculate `nodeOpacity` (e.g., 0.2 for dimmed nodes)
3. Lines 270-334: Render layers (glow, occlusion, ring)
4. Each layer sets `ctx.globalAlpha = nodeOpacity`

**BUT**: The issue is that line 229 happens at the START of every node render, which is correct for resetting state between nodes. The real problem is elsewhere.

---

## Wait... Let Me Re-Investigate

Actually, looking more carefully:

1. Line 229: Reset to `globalAlpha = 1` ✓ (correct - resets between nodes)
2. Line 271-273: Glow sets `ctx.globalAlpha = glowOpacity` ✓
3. Line 303: Occlusion sets `ctx.globalAlpha = nodeOpacity` ✓
4. Line 312: Ring sets `ctx.globalAlpha = nodeOpacity` ✓

This SHOULD work... unless...

### Hypothesis #1: drawGradientRing Resets Alpha Internally

**Location**: `canvasUtils.ts` (not viewed yet)

The `drawGradientRing()` function might be resetting `ctx.globalAlpha` internally. We removed the reset AFTER the call (line 325), but the function itself might set it.

### Hypothesis #2: Context Save/Restore Issue

**Location**: Lines 272-278 (glow rendering)

```typescript
ctx.save();
ctx.globalAlpha = glowOpacity;
drawTwoLayerGlow(...);
ctx.restore();
```

The `ctx.restore()` at line 278 restores the context to the state at `ctx.save()` (line 272). At that point, `globalAlpha` was still 1 (from line 229). So after the restore, we're back to `globalAlpha = 1`.

**This means**:
- Glow renders with correct opacity ✓
- After glow, context is restored to `globalAlpha = 1` ❌
- Occlusion sets `ctx.globalAlpha = nodeOpacity` ✓
- Ring sets `ctx.globalAlpha = nodeOpacity` ✓

So occlusion and ring SHOULD work... unless there's another save/restore or internal reset.

### Hypothesis #3: Theme Node Style

**Location**: Line 255

```typescript
if (theme.nodeStyle === 'ring') {
    // ... glow/occlusion/ring rendering ...
} else {
    // Normal mode
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = node.isFixed ? theme.nodeFixedColor : theme.nodeFillColor;
    ctx.fill();
    ctx.strokeStyle = theme.nodeStrokeColor;
    ctx.lineWidth = strokeWidthPx;
    ctx.stroke();
}
```

**AHA!** The `else` block (normal/filled mode) at lines 353-360 does NOT apply `nodeOpacity` at all! It just renders directly.

**Question**: What is the user's `theme.nodeStyle`?
- If `'ring'`: Our code should work (opacity applied to glow/occlusion/ring)
- If `'filled'`: Our code is MISSING - no opacity applied!

---

## Edge Cases Identified

### Edge Case #1: Normal/Filled Node Style
**Condition**: `theme.nodeStyle === 'filled'`  
**Impact**: nodeOpacity is calculated but never applied  
**Fix**: Add `ctx.globalAlpha = nodeOpacity` before fill/stroke in else block

### Edge Case #2: drawGradientRing Internal Reset
**Condition**: `drawGradientRing()` sets `ctx.globalAlpha` internally  
**Impact**: Ring opacity override  
**Fix**: Check `canvasUtils.ts` and ensure it respects caller's alpha

### Edge Case #3: Multiple Save/Restore Nesting
**Condition**: Nested save/restore in glow → occlusion → ring  
**Impact**: Context state confusion  
**Fix**: Ensure each layer manages its own state correctly

### Edge Case #4: nodeDrawOrder Configuration
**Condition**: User has custom `theme.nodeDrawOrder`  
**Impact**: Layers render in unexpected order  
**Fix**: Verify default order is `['glow', 'occlusion', 'ring']`

### Edge Case #5: Glow Disabled
**Condition**: `theme.glowEnabled === false` or `theme.useTwoLayerGlow === false`  
**Impact**: Glow layer skipped, but occlusion/ring should still work  
**Fix**: Ensure occlusion/ring opacity still applies

### Edge Case #6: Fixed Nodes
**Condition**: `node.isFixed === true`  
**Impact**: Fixed nodes might have special rendering path  
**Fix**: Verify fixed nodes also respect nodeOpacity

---

## Suspect Priority Ranking

1. **HIGH**: Normal/filled node style (else block) missing opacity ← MOST LIKELY
2. **MEDIUM**: `drawGradientRing()` internal alpha reset
3. **LOW**: Save/restore nesting issues
4. **LOW**: Custom nodeDrawOrder
5. **VERY LOW**: Glow disabled
6. **VERY LOW**: Fixed nodes

---

## Recommended Investigation Steps

1. **Check user's theme**: What is `theme.nodeStyle`?
2. **View canvasUtils.ts**: Does `drawGradientRing()` reset alpha?
3. **Add debug logging**: Log `nodeOpacity` and `ctx.globalAlpha` before each render
4. **Test both modes**: Verify behavior in both 'ring' and 'filled' styles

---

## Immediate Fix Hypothesis

**If nodeStyle is 'filled'**, add this to the else block:

```typescript
} else {
    // Normal mode
    ctx.globalAlpha = nodeOpacity;  // ← ADD THIS
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = node.isFixed ? theme.nodeFixedColor : theme.nodeFillColor;
    ctx.fill();
    ctx.strokeStyle = theme.nodeStrokeColor;
    ctx.lineWidth = strokeWidthPx;
    ctx.stroke();
}
```

---

## Conclusion

**Most Likely Cause**: User is using `nodeStyle: 'filled'` (NORMAL_THEME default), and we only implemented opacity for `nodeStyle: 'ring'` (ELEGANT_THEME).

**Verification Needed**: Check user's active theme and nodeStyle setting.
