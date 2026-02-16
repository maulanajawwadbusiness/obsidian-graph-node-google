# Step 8 Move + Step 9 Audit Run 4 - Final Audit and Invariants

Date: 2026-02-16
Run: r4
Scope: finalize audit, add light dev counters, and sync system docs.

## Final code updates

1. `src/runtime/viewport/useResizeObserverViewport.ts`
   - added dev-only counters:
     - `viewportPositionRefreshEvents`
     - `viewportSettleFrames`
   - counters increment only in DEV and add no new runtime loops.
2. Boxed fallback tightening in targeted overlays:
   - `src/ui/tooltip/TooltipProvider.tsx`
   - `src/popup/NodePopup.tsx`
   - `src/popup/MiniChatbar.tsx`
   - `src/popup/ChatShortageNotif.tsx`
   - boxed branches now prefer viewport/bounds fallback dimensions (`>=1`) instead of window-based fallbacks.
3. Docs sync:
   - `docs/system.md` updated for movement-aware step 8 behavior and step 9 dependency/invariants.

## Final audit checks

1. Viewport origin source regression scan:
   - `contentRect.left/top` usage in `src/runtime/viewport/*`: none.
2. Step 9 boxed-local correctness:
   - `MiniChatbar` below-placement now clamps with `localPopupRect.left` (no client-space leak).
3. Boxed fallback policy:
   - targeted overlay boxed branches use viewport/bounds fallback dimensions and avoid window dependency in boxed decision path.

## Acceptance criteria mapping

Step 8:
1. Origin updates without resize: covered by movement listeners + scheduled flush.
2. No permanent loop: settle loop is bounded by stable-frame + max-frame caps.
3. StrictMode safety: cleanup removes listeners, cancels rAF, disconnects observer.
4. Resource tracking: listener + settle-rAF tracks added and released on cleanup/stop.

Step 9:
1. Boxed clamp uses viewport origin/size: retained and rechecked in targeted consumers.
2. Boxed paths avoid window-based fallback assumptions: tightened in targeted files.
3. No double-subtraction: fixed concrete `MiniChatbar` leftover.
4. Missing bounds warn-once fallback remains in `viewportMath`.

## Files changed in this run

- `src/runtime/viewport/useResizeObserverViewport.ts`
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `docs/system.md`
- `docs/report_2026_02_16_step8_move_step9_audit_r4.md`

## Verification

- `npm run build` passes.
