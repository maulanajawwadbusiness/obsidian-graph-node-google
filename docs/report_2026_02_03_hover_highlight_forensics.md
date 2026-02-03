# Forensic Report: Hover Highlight System

**Date:** 2026-02-03
**Subject:** Diagnostics of Patchy Highlights & X-Thing Dimming Failures

---

## 1. TL;DR: Root Causes

*   **Failure A (Nodes not dimming):**
    *   **Reason:** The rendering pathway for `nodeStyle: 'filled'` (default in Normal theme) **completely ignores** the calculated `nodeOpacity` / `ctx.globalAlpha`.
    *   **Fix:** Add `ctx.globalAlpha = nodeOpacity` to the `else` block in `graphDraw.ts`.

*   **Failure C (Neighbor edge dimmed under blue / popping):**
    *   **Reason:** `neighborEdgeKeys` are cleared **immediately** when the cursor leaves the node, while `dimEnergy` fades out slowly over 100ms.
    *   **Result:** As soon as hover ends, the "Blue Highlighting Pass" (Pass 2) stops finding matches. The edge falls back to "Pass 1" (Dimmed Pass) which is currently fading back from dim (0.2) to full (1.0). The user sees the blue line vanish instantly, revealing a dim white line underneath that slowly brightens.

---

## 2. Render Pipeline Map

```mermaid
graph TD
    A[Input State] --> B[Hover Controller]
    B --> C{Active Node?}
    C -->|Yes| D[Populate Neighbor Sets]
    C -->|No| E[Clear Neighbor Sets]
    
    A --> F[Render Loop]
    F --> G[Update Energy]
    G -->|Logic| H[Calculate dimEnergy 0.0-1.0]

    F --> I[Draw Links]
    I --> J{Active Highlight?}
    J -->|Yes| K[Pass 1: Draw Non-Neighbors (Dimmed)]
    J -->|Yes| L[Pass 2: Draw Neighbors (Blue Highlight)]
    J -->|No| M[Draw All Normal]
    
    F --> N[Draw Nodes]
    N --> O[Calc Node Opacity]
    O --> P{Style == Ring?}
    P -->|Yes| Q[Apply Opacity (Glow/Ring)]
    P -->|No| R[Legacy Filled Path (NO OPACITY APPLIED)] --> S[FAILURE A]
```

### Key Functions & Locations

*   **State Update**: `hoverController.ts` -> `updateHoverSelection`
    *   *Updates `neighborNodeIds` / `neighborEdgeKeys`*
*   **Dim Logic**: `hoverEnergy.ts` -> `updateHoverEnergy`
    *   *Calculates `dimEnergy` based on presence of active node*
*   **Edge Drawing**: `graphDraw.ts` -> `drawLinks`
    *   *Applies 2-pass rendering based on `neighborEdgeKeys`*
*   **Node Drawing**: `graphDraw.ts` -> `drawNodes` -> `renderNode`
    *   *Applies opacity to layers*

---

## 3. Analysis: Failure A (X-Things Nodes Not Dimming)

The user is using `NORMAL_THEME` which sets `nodeStyle: 'filled'` (confirmed in `theme.ts`).

**Code Evidence (`graphDraw.ts`):**

```typescript
// Line 247: Opacity calculated correctly
let nodeOpacity = 1;
if (dimEnergy > 0.01...) { ... }

// Line 256: Branching based on style
if (theme.nodeStyle === 'ring') {
    // Ring Logic - Applies opacity correctly
    // ...
} else {
    // Normal/Filled Logic (Lines 352-361)
    // ❌ CRITICAL FAILURE: ignores nodeOpacity
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = node.isFixed ? theme.nodeFixedColor : theme.nodeFillColor;
    ctx.fill(); // Renders at globalAlpha = 1 (reset at line 229)
    // ...
}
```

**Why it happens:**
The `nodeOpacity` variable is computed but never used in the `else` block. The context's `globalAlpha` was reset to `1` at the beginning of the function and remains `1` for filled nodes.

---

## 4. Analysis: Failure C (Patchy Edge Highlights)

The "blue sticker" visual glitch is a synchronization issue between **state** (logic) and **energy** (animation).

**The Sequence of Failure:**
1.  **Cursor Exits Node**: `hoveredNodeId` becomes `null`.
2.  **State Cleared**: `hoverController.ts` runs:
    ```typescript
    } else {
        hoverStateRef.current.neighborNodeIds = new Set(); // CLEARED INSTANTLY
        hoverStateRef.current.neighborEdgeKeys = new Set();
    }
    ```
3.  **Energy Decays**: `dimEnergy` starts fading from `1.0` -> `0.0` (takes 100ms).
4.  **Render Frame (t+10ms)**:
    *   `dimEnergy` is `0.9` (High).
    *   `neighborEdgeKeys` is `empty`.
    *   **Pass 1 (Dimmed)**: Filter `!neighborEdgeKeys.has(key)` is **TRUE** for ALL edges (including neighbors).
    *   **Result**: Neighbors draw in Pass 1 as **Dimmed White** (`opacity ~0.3`).
    *   **Pass 2 (Blue)**: Filter `neighborEdgeKeys.has(key)` is **FALSE**.
    *   **Result**: Neighbors DO NOT draw in Pass 2.
    *   **Visual**: Blue line vanishes instantly, replaced by a ghosted white line trying to fade back in.

**Correct Draw Order (Conceptually):**
1.  **Pass 1**: Base Edges (Dimmed) - *Behind*
2.  **Pass 2**: Highlight Edges (Blue) - *On Top*

But because the classification logic clears instantly, the "Blue Pass" loses its targets while the dimming animation is still active.

---

## 5. Fix Options

### Fix for A (Nodes)
*   **Status**: Easy / Low Risk
*   **Action**: Insert `ctx.globalAlpha = nodeOpacity;` inside the `else` block of `renderNode`.

### Fix for C (Edges)
*   **Option 1: Sticky Neighbors (Recommended)**
    *   Do not clear `neighborNodeIds` / `neighborEdgeKeys` when `activeNodeId` becomes null.
    *   Only clear them when `dimEnergy` hits `0`.
    *   *Benefit*: Keeps the blue highlight active during the fade-out logic.
*   **Option 2: Energy-Gated Clearing**
    *   In `hoverController`, checking `dimEnergy > 0` before clearing sets is messy (controller shouldn't know about rendering energy).
*   **Option 3: Separate "Target" Helper**
    *   Introduce `targetNeighborNodeIds` and lerp/blend. (Too complex).

---

## 6. Risk Notes

*   **Performance**: The Sticky Neighbor approach adds zero cost (actually saves set allocations).
*   **Maintainability**: The `nodeStyle` split currently duplicates logic (rendering selection circles, etc). It should eventually be unified or carefully guarded to ensure features (like dimming) apply to both.
*   **Future Regression**: If `dimEnergy` logic changes, the "Sticky" logic in Option 1 must be kept in sync (e.g. if we switch to spring-based animations).
