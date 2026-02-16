# Step 9 Boxed Viewport Run 1 - Migration Map (Window Assumption Purge)

Date: 2026-02-16
Run: r1
Scope: exhaustive mapping of window-sized assumptions in runtime path, no logic changes.

## Targeted Migration Map

| File:Line | Current behavior | Intended boxed behavior | Proposed change |
|---|---|---|---|
| `src/ui/tooltip/TooltipProvider.tsx:133-138` | Uses `window.innerWidth/innerHeight` fallback and container bounds from portal scope; computes anchor local with portal bounds. | In boxed mode, use `GraphViewport.width/height/boundsRect` as primary clamp and origin source. | Inject `useGraphViewport()` and route boxed clamp/origin math through viewport helpers. Keep app mode behavior unchanged. |
| `src/popup/NodePopup.tsx:113-116` | Positioning uses `window.innerWidth/innerHeight` unless `portalMode==='container'` with portal bounds. | In boxed mode, width/height/origin must come from `GraphViewport`. | Add viewport-aware math helper usage in `computePopupPosition`; keep app fallback path intact. |
| `src/popup/NodePopup.tsx:177` | Initial fallback popup height uses `window.innerHeight * 0.8`. | In boxed mode, fallback height should derive from viewport height. | Replace fallback with viewport-sized height in boxed mode. |
| `src/popup/MiniChatbar.tsx:129-135` | Chatbar clamp uses window size fallback and local conversion from portal bounds. | In boxed mode, use viewport size and viewport origin conversion. | Add `useGraphViewport()`, derive boxed local popup rect and clamp limits from viewport helpers. |
| `src/popup/ChatShortageNotif.tsx:94-99` | Notification clamp uses `window.innerWidth/innerHeight` fallback and portal bounds conversion. | In boxed mode, clamp and anchor local conversion must use viewport contract. | Add viewport hook and boxed helper path for size + origin; preserve app mode behavior. |

## Camera + Pointer normalization audit (already mostly correct)

| File:Line | Current behavior | Step 9 action |
|---|---|---|
| `src/playground/rendering/graphRenderingLoop.ts:336, 598` | Uses `canvas.getBoundingClientRect()` for wheel and render-loop pointer math. | Keep as-is. Already container-relative and valid for boxed mode. |
| `src/playground/rendering/camera.ts:98-109` | `clientToWorld` subtracts `rect.left/top` and uses rect dimensions. | Keep as-is. Already rect-origin normalized. |
| `src/playground/GraphPhysicsPlaygroundShell.tsx:302, 366, 461` | Pointer handlers pass local element/canvas rect into rendering hooks. | Keep as-is. No window-sized assumption to purge for step 9. |

## Minimum change set selected for Step 9

1. Introduce small viewport math helper module for boxed conversions/clamp.
2. Update only these UI position systems:
- Tooltip
- NodePopup
- MiniChatbar
- ChatShortageNotif
3. Do not alter camera containment logic this step (already rect-based).
4. Do not alter pointer->world algorithm this step (already rect-based).

## Risk and conflict notes

- Portal scope and viewport source may differ in app mode. Step 9 gates viewport consumption to `viewport.mode==='boxed'` only to prevent graph-screen regressions.
- Existing portal container math remains fallback for app mode.
- Keep diff minimal: avoid touching unrelated overlay modules (e.g. CanvasOverlays) in this run.
