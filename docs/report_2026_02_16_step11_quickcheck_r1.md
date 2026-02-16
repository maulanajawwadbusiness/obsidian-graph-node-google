# Step 11 Quickcheck Run 1 - Inventory And Risk Map

Date: 2026-02-16
Scope: preview runtime boxed path only (SampleGraphPreview -> GraphPhysicsPlayground runtime)

## Summary
Step 11 guardrails are mostly in place. The remaining work for this quickcheck pass is seam tightening, not broad behavior change.

Key existing protections already active:
1. Boxed portal policy seam in `src/runtime/ui/boxedUiPolicy.ts`.
2. Boxed policy usage in portal surfaces:
   - `src/popup/PopupOverlayContainer.tsx`
   - `src/ui/tooltip/TooltipProvider.tsx`
   - `src/playground/components/AIActivityGlyph.tsx`
3. Boxed disable paths in `src/playground/components/CanvasOverlays.tsx`.
4. Boxed block for dev JSON download path in `src/playground/GraphPhysicsPlaygroundShell.tsx`.

## Reachable Surface Inventory (preview runtime only)

| File:line | Surface | Reachable in boxed preview | Current boxed policy | Risk |
|---|---|---|---|---|
| `src/popup/PopupOverlayContainer.tsx:55` | Popup portal host | Yes | `resolveBoxedPortalTarget(...)` + disable on null | Low |
| `src/ui/tooltip/TooltipProvider.tsx:294` | Tooltip portal host | Yes | `resolveBoxedPortalTarget(...)` + disable on null | Low |
| `src/playground/components/AIActivityGlyph.tsx:52` | Activity glyph portal host | Yes | `resolveBoxedPortalTarget(...)` + disable on null | Low |
| `src/playground/components/CanvasOverlays.tsx:395` | Top-right action icons/menu (fullscreen path) | Yes | hidden in boxed via `!isBoxedRuntime`; dots menu force-close in boxed | Low |
| `src/playground/components/CanvasOverlays.tsx:546` | Debug overlay panel with viewport-sized constraints | Yes | gated `debugOpen && !isBoxedRuntime`; forced close effect in boxed | Low |
| `src/playground/GraphPhysicsPlaygroundShell.tsx:700` | Dev download action path | Yes | early boxed return + `countBoxedSurfaceDisabled(...)` | Low |
| `src/playground/GraphPhysicsPlaygroundShell.tsx:758` | `document.body.appendChild(anchor)` in dev download branch | Conditionally reachable only if boxed guard regresses | boxed guard exists before branch | Medium (worth tightening invariant rails) |

## Non-Reachable / Out Of Scope In This Pass

| File:line | Why excluded |
|---|---|
| `src/auth/LoginOverlay.tsx:218` | AppShell overlay path, not runtime overlay inside preview graph subtree |
| `src/components/Sidebar.tsx:*` | AppShell/sidebar overlays, not preview runtime-owned surface |
| `src/components/PaymentGopayPanel.tsx:*` | EnterPrompt/AppShell surface, not runtime portal surface |
| `src/fullchat/FullChatToggle.tsx:*` | `FULLCHAT_ENABLED=false` currently, therefore inactive in preview runtime |

## Conflicts / Fragile Seams Noted
1. `PortalScopeContext` defaults to `document.body` in absence of provided root (`src/components/portalScope/PortalScopeContext.tsx:20`), so boxed safety relies on each portal callsite using boxed policy correctly.
2. `resolveBoxedPortalTarget(...)` currently tracks blocked body attempts but does not expose redirect count; useful for quickcheck diagnostics.
3. Current policy signature assumes non-null `portalTarget: HTMLElement`; callsites are safe today, but seam can be tightened to guard future null/undefined usage.

## Patch Intent For Next Runs
1. Harden `boxedUiPolicy` diagnostics and invariants with minimal API expansion.
2. Re-verify callsites; patch only if run 1 missed any preview-reachable escapes.
3. Keep app mode unchanged.

## Verification
- Command: `npm run build`
- Result: pass in this run.
