# Step 11 Boxed UI Rules Run 1

Date: 2026-02-16
Scope: exhaustive runtime inventory for boxed preview path

## Reachable runtime surfaces in boxed preview

| file:line | surface | current mount target | why fullscreen-ish | boxed rule |
|---|---|---|---|---|
| `src/playground/components/CanvasOverlays.tsx:471` | dots action menu | inline inside runtime tree | `position: fixed`, window-anchored menu metrics | disable in boxed |
| `src/playground/components/CanvasOverlays.tsx:120` | menu placement math | window dimensions | uses `window.innerWidth/innerHeight` | disable path in boxed |
| `src/playground/components/CanvasOverlays.tsx:521` | fullscreen toggle action | fullscreen API (`document.documentElement`) | global fullscreen behavior | disable in boxed |
| `src/playground/components/CanvasOverlays.tsx:476` | debug overlay panel | inline runtime tree | `position: fixed`, viewport-wide assumptions (`100vw/100vh`) | local-contained variant in boxed |
| `src/playground/components/AIActivityGlyph.tsx:63` | activity glyph portal | `usePortalRootEl()` | portal path must never fallback to body in boxed | portal guard + contain |
| `src/popup/PopupOverlayContainer.tsx:44` | popup portal host | `usePortalRootEl()` | portal root safety required in boxed | portal guard + contain |
| `src/ui/tooltip/TooltipProvider.tsx:285` | tooltip portal host | `usePortalRootEl()` | portal root safety required in boxed | portal guard + contain |
| `src/playground/GraphPhysicsPlaygroundShell.tsx:750` | dev JSON export download anchor | `document.body.appendChild(anchor)` | direct body touch from boxed runtime | disable in boxed |

## Non-scope surfaces (not runtime path owned by preview)

1. `src/screens/appshell/overlays/ModalLayer.tsx` (AppShell modal system).
2. `src/auth/LoginOverlay.tsx` (EnterPrompt shell overlay).
3. `src/components/Sidebar.tsx`, `src/components/BalanceBadge.tsx`, `src/components/MoneyNoticeStack.tsx`, `src/components/ShortageWarning.tsx` (screen-shell overlays, not runtime child UI).

These remain out of Step 11 scope because they are not mounted by graph runtime components within `SampleGraphPreview`.

## Conflict and dependency notes

1. Step 10 already enforced boxed input ownership. Step 11 must not regress pointer/wheel guards.
2. Existing container portal mode already routes portals to preview root, but fallback-to-body is still possible if target resolution fails.
3. We need a single policy helper to avoid duplicated body-portal checks and warn-once logic.

## Run 1 verification

- `npm run build` executed after this report.