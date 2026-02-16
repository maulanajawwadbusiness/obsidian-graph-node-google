# Step 7 Viewport Contract Report (Run 1)

Date: 2026-02-15
Scope: forensic seam selection and contract draft

## Chosen Provider Seam

Primary placement strategy:
1. Graph screen runtime subtree:
- file: `src/screens/appshell/render/renderScreenContent.tsx`
- wrap graph runtime branch (`GraphRuntimeLeaseBoundary` + `GraphWithPending`) with viewport provider.

2. Prompt preview runtime subtree:
- file: `src/components/SampleGraphPreview.tsx`
- wrap preview runtime mount (`GraphPhysicsPlayground`) with viewport provider.

Why this seam:
- Covers both real runtime entry paths without prop-threading through `GraphPhysicsPlaygroundProps`.
- Preserves existing App mode behavior and allows boxed override in preview path.
- Keeps provider outside runtime internals for minimal diff and clean migration in step 8/9.

## Contract Draft (Step 7)

Proposed types:
- `mode: 'app' | 'boxed'`
- `source: 'window' | 'container' | 'unknown'`
- `width: number`
- `height: number`
- `dpr: number`
- `boundsRect: { left:number; top:number; width:number; height:number } | null`

## Current Viewport Read Sites (for step 9 migration later, no changes now)

Graph runtime path:
- `src/playground/useGraphRendering.ts:90`
  - `window.devicePixelRatio`
- `src/playground/rendering/renderLoopSurface.ts:16`
  - `window.devicePixelRatio`
- `src/playground/rendering/graphRenderingLoop.ts:336`
  - `canvas.getBoundingClientRect()`
- `src/playground/rendering/graphRenderingLoop.ts:598`
  - `canvas.getBoundingClientRect()` for wheel transform
- `src/playground/GraphPhysicsPlaygroundShell.tsx:283,302,366,412,461`
  - container/canvas rect reads for pointer and popup placement

Graph overlays and menus using viewport/window directly:
- `src/playground/components/CanvasOverlays.tsx:120,124,130,134,215,220,936`
  - window width/height/DPR math
- `src/components/Sidebar.tsx:238-296`
  - window width/height menu clamping

## Step 7 Non-Goals Reconfirmed
- No ResizeObserver streaming contract updates yet (step 8).
- No clamp-site migration yet (step 9).
- No changes to lease, portal scope, wheel guard logic, or leak tracker behavior.
