# Report: EnterPrompt Dev Send Button

Date: 2026-02-13

## Scope
- Added a tiny corner send button on the EnterPrompt onboarding screen.
- Kept implementation local to one screen component with no backend calls.

## Files Changed
- `src/screens/EnterPrompt.tsx`
  - Added `DEV_URL` constant.
  - Added `sendHelloToDev()` click handler:
    - builds URL: `https://dev.arnvoid.com/?msg=HELLO!` (encoded via `encodeURIComponent`)
    - logs click target with `console.info("[enterprompt] sendHelloToDev ->", url)`
    - opens new tab with `window.open(url, "_blank", "noopener,noreferrer")`
  - Added a small absolute-positioned `send` button in the top-right of the EnterPrompt root container.

## Placement
- Button is positioned inside EnterPrompt root (`position: relative`) using absolute top-right offsets (`top: 12px`, `right: 12px`).
- `onPointerDown` stops propagation to avoid pointer capture conflicts with parent surfaces.

## Manual Test Steps
1. Run app locally: `npm run dev`.
2. Navigate to onboarding EnterPrompt screen (3rd screen).
3. Click the `send` button in the top-right corner.
4. Confirm browser opens a new tab to:
   - `https://dev.arnvoid.com/?msg=HELLO%21`
5. In DevTools console, confirm log line appears:
   - `[enterprompt] sendHelloToDev -> https://dev.arnvoid.com/?msg=HELLO%21`
6. On dev site, confirm first input box receives `HELLO!` from query param.

## Verification Notes
- Local compile/build check passed: `npm run build`.
- Browser interaction verification requires manual click in local runtime.
