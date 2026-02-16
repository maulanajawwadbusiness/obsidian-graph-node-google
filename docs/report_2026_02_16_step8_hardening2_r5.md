# Step 8 Hardening Round 2 Run 5 - Final Audit and Bedrock Checklist

Date: 2026-02-16
Run: r5
Scope: final audit, reason-level dev counters, and docs sync for hardened Step 8 trigger model.

## Final hook updates

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Added dev-only flush reason counters:
   - `ro`
   - `scroll`
   - `vv`
   - `interaction`
   - `mount`
   - `visibility`
2. Refresh triggers now route through reason-tagged scheduling:
   - RO callback -> `ro`
   - mount seed -> `mount`
   - window scroll/resize -> `scroll`
   - visualViewport scroll/resize -> `vv`
   - pointer/wheel interaction -> `interaction`
   - visibility return -> `visibility`
3. No console spam added; counters are increment-only.

## Final audit checks

1. Origin source scan:
   - no `contentRect.left/top` origin usage in viewport runtime.
2. Settle loop boundedness:
   - stable-frame stop path + hard cap + hidden-tab stop guard are all active.
3. No permanent polling:
   - refresh remains event-driven with bounded settle continuation only.

## Docs updated

File: `docs/system.md`

Step 8 contract now explicitly includes:
- RO size source and BCR origin source.
- movement refresh via scroll/visualViewport events.
- target interaction-triggered refresh.
- mount stabilization burst.
- visibility-safe settle behavior.
- interaction listener tracker and flush-reason counter notes.

## Bedrock checklist status

A) stale origin on non-resize movement: covered by movement + interaction + mount stabilization.
B) boxed preview interaction freshness: interaction refresh path in hook added.
C) cleanup safety: listeners/observer/raf release paths retained and hardened.
D) settle bounded + hidden safe: active.
E) no always-on loop: active.

## Verification

- `npm run build` was executed and is currently blocked by an unrelated concurrent worktree error:
  - `src/screens/appshell/render/graphLoadingGateMachine.ts:64`
  - `TS2367: comparison appears to be unintentional because the types '"analysis" | "restore"' and '"none"' have no overlap.`
- Step 8 hardening files compile in scope, but full repo build is red due to the unrelated file above.
