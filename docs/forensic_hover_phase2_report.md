# Forensic Report Phase 2: Input Pipeline Blockage

## New Evidence
- **SEEN**: `[HoverDbg] DOM PointerMove` (in `GraphPhysicsPlayground.tsx`).
- **SEEN**: `[HoverDbg] Loop Check`.
- **NOT SEEN**: `[HoverDbg] Input Active` (in `hoverController.ts`).
- **NOT SEEN**: `[HoverDbg] Window PointerMove`.

## Analysis

### The Critical Breakpoint
The `DOM PointerMove` log proves that `GraphPhysicsPlayground` is receiving events.
The `Input Active` log (which is missing) is located inside `handlePointerMove`.

The code execution flow in `GraphPhysicsPlayground.tsx` is:
```typescript
const onPointerMove = (e: React.PointerEvent) => {
    // 1. [HoverDbg] DOM Log (SEEN)
    if (Math.random() < 0.01) console.log(...);

    const canvas = canvasRef.current;
    
    // 2. The Blocker?
    if (!canvas) return; 

    // 3. Call Handler (NOT SEEN)
    handlePointerMove(...);
};
```

### Conclusion
The execution is terminating at step 2. **`canvasRef.current` appears to be null** during the event.
If `canvasRef` is null, the handler aborts, `handlePointerMove` is never called, `hasPointer` never becomes true, and the loop never triggers hover updates.

This also explains why the Loop Check implies hover is dead (`hasPtr` likely false).

### Window Log Mystery
The missing window log (`window.addEventListener`) suggests either:
1.  Events are stopped (`stopPropagation`) before reaching window (though `DOM` log sees them, so they are bubbling *to* the React root at least?).
2.  Or the 0.5% probability was too low for the testing duration.

## Root Cause Logic
The `canvas` element exists in the DOM (logs show `target=CANVAS` sometimes? Or user just says DOM log appears).
However, the `ref` object (`canvasRef`) held by React might be stale or disconnected.

## Recommended Fix
1.  **Immediate**: Remove the `if (!canvas) return` check temporarily to prove `handlePointerMove` works. Passing `rect` (which relies on canvas) might be the issue, but we can compute rect from `e.currentTarget`.
2.  **Correction**: Ensure `canvasRef` is properly attached.
