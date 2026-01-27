# Membrane Animation: Final Implementation Clarifications

This document serves as a technical appendum to the `membrane_animation_report.md`, focusing on the constraints and contracts required for safe reuse in other windows/components.

---

### 1) Anchor Geometry Contract
*   **Property Usage**: While the `AnchorGeometry` type includes `radius`, it is only used to compute the *bounding box* (the `left`/`top` coordinates). The "membrane" effect (the emergence pivot) relies strictly on `{ x, y }`.
*   **Point-Sourced Emergence**: The animation works perfectly with a single point. If the `radius` is 0, the window sprouts directly from the provided coordinates.
*   **Domain Agnostic**: There is no code dependency requiring the anchor to be a graph node. Any viewport coordinate pair is a valid sprout origin.

### 2) Store & Lifecycle Dependency
*   **Decoupling Status**: The animation logic is **not** fundamentally tied to `PopupStore`. It is a self-contained visual sequence triggered by change.
*   **Portability**: To reuse this in a local component, you only need to port the "staged reveal" logic:
    ```typescript
    // Minimum state for local reuse
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        setIsVisible(false); // Reset
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, [triggerKey]); // Reset when target changes
    ```

### 3) Positioning Context Requirements
*   **Math Assumptions**: The `transform-origin` calculation (`anchor.x - left`) assumes the component's coordinate space matches the `anchor` coordinate space (usually the global viewport).
*   **The "Flex" Pitfall**: If applied inside a normal flow container (e.g., a nested Flexbox), the `left`/`top` values will be relative to the parent, while `anchor.x/y` are global. This mismatch causes the popup to emerge from an incorrect, offset location.
*   **Layering**: A `fixed` or `absolute` portal is required to:
    1.  Ensure `z-index` superiority over the graph.
    2.  Prevent `filter: blur` and `box-shadow` from being clipped by containers with `overflow: hidden`.
    3.  Avoid layout shifts in the rest of the UI during the "elastic overshoot."

### 4) Reduced Motion & Accessibility
*   **Handle Status**: **Not implemented.**
*   **Behavior**: The animation runs unconditionally. For a "premium" feel, future implementations should honor the `prefers-reduced-motion` media query by setting `transition: none` or significantly reducing the `scale` and `blur` deltas.

### 5) Teardown & Rapid Interaction
*   **Timer Safety**: All `setTimeout` IDs are tracked and cleared on unmount/re-run. No "zombie" state updates occur.
*   **Rapid Switching**: When clicking nodes in quick succession, the component resets to `opacity: 0` and `scale(0.8)` immediately. 
*   **Exit Logic**: Currently, there is no "closing" animation. The component is instantly unmounted by the parent. To implement a "reverse membrane" exit, the component would need to manage its own "isClosing" state before calling the store's `closePopup`.

---
*Date: 2026-01-27*  
*Status: Verified investigating NodePopup.tsx*
