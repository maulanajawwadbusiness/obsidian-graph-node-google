# Forensic Report: Dev-Mode JSON Download Button (Graph Screen)

Date: 2026-02-10
Mode: Forensic only (no implementation)

## Root Summary
The safest place for a dev-only download icon button is the graph overlay layer inside `GraphPhysicsPlayground`, either as a new overlay sibling near `CanvasOverlays` or as a prop-driven addition inside `CanvasOverlays`. Existing overlay controls already use absolute/fixed positioning and pointer shielding (`onPointerDown` + stopPropagation), which matches the non-interference requirement. Authoritative export data is available at runtime from `getTopology()` seam, `documentContext.state.activeDocument`, engine node world positions, hover camera snapshot values, and engine node meta (`sourceTitle/sourceSummary`) for popup analysis payload.

## 1) Mount Point: Graph Screen UI Surface

### Where graph chrome is rendered
- Graph screen composition is in `src/playground/GraphPhysicsPlayground.tsx:1192-1258`.
- Overlay controls are mounted inside the graph root (`MAIN_STYLE`) alongside `<canvas>`:
  - `<CanvasOverlays ... />` at `src/playground/GraphPhysicsPlayground.tsx:1216-1252`.

### Existing top-right controls pattern
- In `CanvasOverlays`, the right/top "Controls" button uses:
  - absolute top-right style via `SIDEBAR_TOGGLE_STYLE` (`right: 16px`) from `src/playground/graphPlaygroundStyles.ts:58-73`.
  - pointer shielding via `onMouseDown`/`onPointerDown` stopPropagation in `src/playground/components/CanvasOverlays.tsx:171-179`.
- Shared overlay pattern is consistent with pointer isolation:
  - `onPointerDown={stopPropagation}` in `src/playground/components/CanvasOverlays.tsx:141`, `src/playground/components/CanvasOverlays.tsx:158`, `src/playground/components/CanvasOverlays.tsx:175`.

### Safest insertion subtree
- Recommended insertion point: same overlay subtree as `CanvasOverlays` controls (`src/playground/components/CanvasOverlays.tsx`), because:
  - already anchored in graph screen
  - already applies non-leaking pointer pattern
  - avoids introducing another free-floating overlay stack.
- Alternative minimal path: add button directly in `GraphPhysicsPlayground.tsx` near `CanvasOverlays` mount (`src/playground/GraphPhysicsPlayground.tsx:1216-1252`) with identical shielding pattern.

## 2) Asset Location and Import Pattern

### Asset exists
- `src/assets/download_dev_mode.png` exists (confirmed in assets list).

### PNG import conventions in repo
- Vite module imports are used for PNGs, e.g.:
  - `src/components/Sidebar.tsx:4` style imports
  - `src/components/FullscreenButton.tsx:3-4` imports for icon PNGs.
- So the new button should use:
  - `import downloadDevModeIcon from '../assets/download_dev_mode.png';` (path adjusted by file location).

### Existing icon-only button pattern
- `FullscreenButton` is icon-only, no fill, no border:
  - button style uses `background: 'transparent'`, `border: 'none'` at `src/components/FullscreenButton.tsx:62-64`.
  - pointer shield at `src/components/FullscreenButton.tsx:38`.
- This is the closest reusable pattern.

## 3) Dev Toggle Source of Truth

### Current dev gating norms
- Direct `import.meta.env.DEV` checks used in graph code:
  - `src/playground/GraphPhysicsPlayground.tsx:42`, `src/playground/GraphPhysicsPlayground.tsx:99`.
- Debug utility gate exists:
  - `IS_DEV` in `src/playground/rendering/debugUtils.ts:8`.
- Local toggle constants exist in overlay components:
  - `SHOW_DEBUG_CONTROLS` in `src/playground/components/CanvasOverlays.tsx:15`.

### Recommended toggle approach
- Dev + explicit local switch near button render site:
  - `const SHOW_DEV_DOWNLOAD_JSON_BUTTON = false;` (easy code toggle)
  - render gate: `import.meta.env.DEV && SHOW_DEV_DOWNLOAD_JSON_BUTTON`.
- Reason: matches request for easy code toggle and existing repo style (local const toggles).

## 4) Authoritative JSON Snapshot Sources

### Topology (canonical seam)
- Use `getTopology()` from topology seam, already imported/used in graph:
  - `src/playground/GraphPhysicsPlayground.tsx:28` import
  - usage at restore/spawn flow: `src/playground/GraphPhysicsPlayground.tsx:569`, `src/playground/GraphPhysicsPlayground.tsx:719`.

### Parsed document (full text/meta/warnings)
- Source: `documentContext.state.activeDocument` from document store context:
  - `DocumentState.activeDocument` in `src/store/documentStore.tsx:23-31`
  - context available in graph as `documentContext`.

### Layout (node world positions)
- Source: current engine node coordinates (`engineRef.current.nodes`) pattern already used:
  - `captureAndPatchSavedLayout` builds `nodeWorld` at `src/playground/GraphPhysicsPlayground.tsx:611-614`.

### Camera snapshot
- Existing capture path reads from hover state cache:
  - `lastSelectionPanX/PanY/Zoom` usage at `src/playground/GraphPhysicsPlayground.tsx:616-619`.
- Camera write API exists (`applyCameraSnapshot`) but no public getter exposed from hook:
  - `src/playground/useGraphRendering.ts:220-243`.
- Therefore export should use the same currently-available capture source (hover snapshot) unless a getter is introduced later.

### Analysis meta (popup summaries)
- Popup reads runtime engine node meta fields:
  - `sourceTitle/sourceSummary` at `src/playground/GraphPhysicsPlayground.tsx:367-370`.
- Export can derive `analysisMeta.nodesById` directly by iterating engine nodes and reading these fields (same semantic source as popup contract).

## 5) Recommended Export Schema (versioned)

```json
{
  "version": 1,
  "exportedAt": 1739212345678,
  "title": "<inferred title or file name>",
  "parsedDocument": { "...full ParsedDocument...": true },
  "topology": { "...getTopology() output...": true },
  "layout": {
    "nodeWorld": {
      "<nodeId>": { "x": 0.0, "y": 0.0 }
    }
  },
  "camera": {
    "panX": 0.0,
    "panY": 0.0,
    "zoom": 1.0
  },
  "analysisMeta": {
    "version": 1,
    "nodesById": {
      "<nodeId>": {
        "sourceTitle": "...",
        "sourceSummary": "..."
      }
    }
  }
}
```

Field provenance:
- `parsedDocument`: `documentContext.state.activeDocument`
- `topology`: `getTopology()`
- `layout.nodeWorld`: `engineRef.current.nodes`
- `camera`: hover snapshot (`lastSelectionPanX/PanY/Zoom`)
- `analysisMeta.nodesById`: engine node meta (`sourceTitle/sourceSummary`)

Secrets check:
- These sources do not include API keys/cookies/auth headers by default.
- Avoid serializing arbitrary global state or request configs.

## 6) Download Mechanics + Filename

### Existing utility scan
- No dedicated frontend file-download helper found in app code.

### Recommended mechanics
- Standard browser Blob flow:
  - `const text = JSON.stringify(payload, null, 2)`
  - `new Blob([text], { type: 'application/json' })`
  - `URL.createObjectURL(blob)` + temporary `<a download=...>` + click + revoke URL.

### Filename rule
- Use sanitized title from inferred title or document file name.
- Suggested format:
  - `arnvoid_<sanitized-title>_<yyyy-mm-dd_hhmm>.json`

## Risks and Edge Cases

1. Pointer leakage to canvas
- Must keep `onPointerDown={(e) => e.stopPropagation()}` on button (and wrapper if added), matching overlay rule.

2. Large document payload size
- Full `parsedDocument.text` can be large; export is synchronous JSON stringify and may block briefly.
- Mitigation later: wrap click handler with small busy guard or schedule via `setTimeout(0)` (implementation stage decision).

3. Camera snapshot quality
- Current readable camera source is hover snapshot, not direct camera state getter.
- If no recent pointer activity, values may be stale; known limitation unless camera getter is exposed in future.

4. Dev-only gating
- Ensure button never appears in production by combining `import.meta.env.DEV` with local toggle constant.

## Done Tests Checklist (post-implementation)

1. Dev mode + toggle ON:
- Button appears top-right as icon-only (no fill/border).

2. Dev mode + toggle OFF:
- Button not rendered.

3. Prod build/runtime:
- Button not rendered regardless of toggle.

4. Click behavior:
- Downloads valid `.json` with expected fields.
- JSON parses and contains non-empty topology.

5. Input shielding:
- Clicking button does not trigger graph drag/pan/selection behind it.
- Wheel over button/wrapper does not leak to canvas.

6. Payload integrity:
- Includes full parsed document text/meta/warnings.
- Includes layout, camera, and analysisMeta when available.

## Step 4 Implemented

Implemented wiring from `GraphPhysicsPlayground` to `CanvasOverlays` so the dev download button exports the current map as JSON.

- Callback bridge:
  - `CanvasOverlays` now accepts `onDevDownloadJson?: () => void`.
  - Graph passes `onDevDownloadJson={handleDevDownloadJson}` at `src/playground/GraphPhysicsPlayground.tsx`.
- Export schema (versioned):
  - `version`, `exportedAt`, `title`
  - `parsedDocument` (full `ParsedDocument`, including full text/meta/warnings)
  - `topology` from `getTopology()`
  - `layout.nodeWorld` from runtime `engineRef.current.nodes`
  - `camera` from current hover snapshot (`lastSelectionPanX/PanY/Zoom`)
  - `analysisMeta` as `{ version: 1, nodesById }` from engine node meta (`sourceTitle/sourceSummary`) when present
- Download path:
  - JSON stringify with 2-space indent
  - Blob `application/json`
  - object URL + anchor click + revoke URL
  - filename format: `arnvoid_<sanitized-title>_<yyyy-mm-dd_hhmm>.json`
- Dev logs:
  - success: `[dev] download_json_ok bytes=... filename=...`
  - skip: `[dev] download_json_skipped reason=no_engine_or_no_topology`

Camera note:
- Current export camera snapshot is sourced from the same hover-state cache used elsewhere in graph code. This is the available camera snapshot source in the current architecture.
