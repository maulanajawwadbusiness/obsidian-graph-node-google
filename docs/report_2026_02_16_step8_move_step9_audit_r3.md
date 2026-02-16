# Step 8 Move + Step 9 Audit Run 3 - Hardening and Boxed Leftover Patch

Date: 2026-02-16
Run: r3
Scope: harden settle lifecycle behavior and patch remaining boxed local-space clamp issue.

## Step 8 hardening

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Settling now progresses even when viewport state does not change:
   - changed flush flow to compute `viewportChanged` first.
   - state publish happens only when changed.
   - settle-frame decrement/scheduling runs independently of publish.
2. This avoids early-return skipping of settle progression and keeps bounded settle behavior deterministic.

## Step 9 targeted fix

File: `src/popup/MiniChatbar.tsx`

1. Fixed boxed/local clamp mismatch in `tryBelow`:
   - before: used `popupRect.left` (client-space input).
   - after: uses `localPopupRect.left` (already origin-normalized local-space).
2. This removes a remaining double-origin risk in boxed mode positioning.

## Verification

- `npm run build` passes.
