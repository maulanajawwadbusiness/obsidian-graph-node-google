# Drag Gating Run 5: Guardrails & Warnings

## Goal
Implement safety checks to detect if the firewall fails (i.e. if the system throttles coverage during drag).

## Changes
1.  **Throttle Tracking**:
    - `dragThrottledTime` tracks how long `spacingStride > 1.1` while `dragActive`.
    - Threshold: 200ms.
2.  **Warning System**:
    - `dragThrottledWarn` flag in `DebugStats` and `PhysicsHudSnapshot`.
    - HUD shows "⚠️ DRAG THROTTLED" in red if triggered.
3.  **Active State Robustness**:
    - `dragActive` remains tied to `draggedNodeId`.
    - Sleep bypass remains effective.

## Verification
- **Positive Control**: Since Run 3 forces `degrade=0` (stride=1) during drag, `spacingStride` should be 1. The warning *should not* appear.
- **Negative Control**: If we disabled Run 3 specific logic, high load would trigger stride > 1 and trip the warning after 200ms.

## Next Steps
- Run 6: Final Hand Acceptance Test Protocol.
