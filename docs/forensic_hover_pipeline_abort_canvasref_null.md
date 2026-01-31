# Forensic Report: Hover Pipeline Abort Fixed

## Symptom
Hover detection was "dead".
Logs confirmed:
- `DOM PointerMove` events were firing.
- `Loop Check` was active.
- `Input Active` (internal handler) was **never reached**.

## Root Cause
The `onPointerMove` handler in `GraphPhysicsPlayground.tsx` contained a fragil guard:
```typescript
const canvas = canvasRef.current;
if (!canvas) return; // ABORT if ref is null
handlePointerMove(...);
```
During the event, `canvasRef.current` was evaluating to `null` (likely due to transient React lifecycle states or conditional rendering interaction), silently killing the input before it reached the logic core.

## Fix Implemented
1.  **Rect Source of Truth**: Switched from `canvasRef.current.getBoundingClientRect()` to `e.currentTarget.getBoundingClientRect()`. `e.currentTarget` is the DOM element receiving the event, so it is **guaranteed** to exist.
2.  **Unconditional Handoff**: Removed the `if (!canvas) return` guard for the `handlePointerMove` call. The input is now passed unconditionally to the logic layer.
3.  **Deterministic Logging**: Replaced random-sampling logs with time-throttled logs (1/sec) to ensure visibility without console spam.

## Verification
- `[HoverDbg] Window Move`: Captures raw browser events (Control).
- `[HoverDbg] DOM Move`: Shows `rect` dimensions and target tag (Proof of dispatch).
- `[HoverDbg] Input Active`: Shows coordinates reaching the internal controller (Proof of plumbing).
- `hover:`: Shows hit test results (Proof of logic).

Hover should now be robust against React ref timing issues.
