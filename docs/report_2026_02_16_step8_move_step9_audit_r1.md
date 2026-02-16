# Step 8 Move + Step 9 Audit Run 1 - Forensic Design Map

Date: 2026-02-16
Run: r1
Scope: no behavior change. Lock movement-refresh design for viewport hook and re-audit boxed step 9 consumers.

## Step 8 forensic findings

File: `src/runtime/viewport/useResizeObserverViewport.ts`

Current update triggers:
1. Initial mount path schedules one viewport flush.
2. ResizeObserver callback schedules viewport flush on observed entry updates.

Current stale-origin gap:
- Origin (`boundsRect.left/top`) is derived correctly from `getBoundingClientRect()` in flush.
- But flush is only triggered by initial mount + ResizeObserver.
- If element moves without resizing (scroll/layout shift/sidebar push), RO may not fire.
- Result: origin can become stale until another resize-like event occurs.

## Step 8 design for minimal robust fix

Keep RO for size truth, add movement-triggered origin refresh:
1. Add movement listeners:
   - `window.scroll` (capture + passive)
   - `window.resize` (passive)
   - `visualViewport.scroll/resize` when available (passive)
2. Movement event handler:
   - mark `positionDirtyRef=true`
   - call existing schedule function (single pending rAF guard remains)
3. Flush logic:
   - read current BCR origin every flush.
   - if origin changed, start short settle burst.
4. Settle burst:
   - bounded rAF continuation only while movement is still settling.
   - no permanent polling loop.
5. Cleanup:
   - remove all movement listeners, cancel pending rAF, clear settle refs.

## Step 9 focused audit results

Targeted files:
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `src/runtime/viewport/viewportMath.ts`

Findings:
1. Boxed origin conversion generally correct:
   - uses `toViewportLocalPoint(...)` in boxed mode.
2. Boxed clamp dimensions generally correct:
   - uses `getViewportSize(viewport, ...)` then clamp against returned size.
3. Concrete leftover bug:
   - `MiniChatbar` `tryBelow` clamps with `popupRect.left` instead of local-space `localPopupRect.left`.
   - this can cause double-origin mismatch in boxed mode.
4. Window fallback assumptions still present in boxed-aware code:
   - several boxed branches pass fallback args derived from `window.innerWidth/innerHeight`.
   - acceptable as fallback safety, but can be tightened to avoid window dependence in boxed path.

## Run 2-4 implementation map

1. Run 2:
   - implement movement listeners + bounded settle rAF in viewport hook.
2. Run 3:
   - harden lifecycle/strictmode/ref-swap and patch `MiniChatbar` leftover.
3. Run 4:
   - final grep/audit and docs invariant updates for movement-aware origin refresh.

## Verification

- `npm run build` passes.
