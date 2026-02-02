# Run 3: Eliminate Second Engine Creation (XPBD Damping)

**Date**: 2026-02-02
**Agent**: Antigravity

## Objective
Ensure the `PhysicsEngine` is created exactly once per component lifecycle and not re-instantiated during every render (which `useRef(new PhysicsEngine())` does, even if it discards the duplicates). This improves stability and ensures the reference can never become desynchronized.

## Changes
1.  **Modified `src/playground/GraphPhysicsPlayground.tsx`**:
    -   Changed engine initialization to lazy pattern:
        ```typescript
        const engineRef = useRef<PhysicsEngine>(null!);
        if (!engineRef.current) {
            engineRef.current = new PhysicsEngine();
        }
        ```
    -   Verified that `grep` shows no other `new PhysicsEngine()` calls in the source tree (except the one we modified).

## Verification Plan
1.  Run the simulation.
2.  Force a re-render (e.g. toggle "Sidebar" or "Debug").
3.  Click a preset button.
4.  **Success**: The `Engine UID` in the logs remains constant across re-renders.
5.  **Failure**: If UID changes on re-render, the engine is being recreated (failed).

## Next Steps
Proceed to Run 4 to address stale closure risks in the event handlers.
