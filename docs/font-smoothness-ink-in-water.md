# Ink-in-Water Font Smoothness Report

## What I found (top crunchy causes)
1. **Viewer body text was anchored at 13px with bright-ish contrast and OS-level smoothing forced in JS.** The body style was set in `DocumentContent.tsx` with `WebkitFontSmoothing`/`MozOsxFontSmoothing`, which can cause unstable rasterization on scroll and inconsistent results across platforms. The body color was relatively bright for the dark sheet. This combination can feel “crunchy” on fast scroll because glyph edges re-raster under composited scroll. 【F:src/document/viewer/DocumentContent.tsx†L29-L38】【F:src/document/viewer/docTheme.ts†L21-L30】
2. **Small UI typography (12px) and medium weights in the viewer header/filename.** The header and document title were using 12px and 500 weight. On dark backgrounds, that pushes edge contrast and makes strokes feel brittle. 【F:src/document/viewer/viewerTokens.css†L2-L5】【F:src/document/viewer/viewerTokens.css†L54-L76】【F:src/document/viewer/viewerTokens.css†L146-L155】
3. **Node popup baseline drifted from the viewer ink family.** Popup text used a neutral gray and system font, which didn’t match the blue-ink palette, making comparisons feel inconsistent. 【F:src/popup/NodePopup.tsx†L8-L75】

## What I changed (files, tokens)
- **Document theme tokens (dark/light):** raised body size to 14px, tuned text/muted text to a calmer blue-white opacity, kept weight at 400. 【F:src/document/viewer/docTheme.ts†L21-L60】
- **Viewer tokens:** bumped `--dv-font-size` to 13px for header/meta elements, set header/title weights to 400, and kept the micro AA text-shadow on the document body while adding `text-rendering: optimizeLegibility` as a safe garnish. 【F:src/document/viewer/viewerTokens.css†L1-L169】
- **Rendering style:** removed forced `WebkitFontSmoothing`/`MozOsxFontSmoothing` from the body wrapper to avoid OS-dependent artifacts. 【F:src/document/viewer/DocumentContent.tsx†L29-L37】
- **Node popup baseline:** aligned popup font family and color to the viewer ink family, locked body weight to 400, and added the same micro AA text-shadow. 【F:src/popup/NodePopup.tsx†L8-L92】
- **Node popup input:** aligned text color and font family to the same ink family. 【F:src/popup/ChatInput.tsx†L22-L46】

## Final “ink-in-water” recipe (body text)
- **Size:** 14px
- **Weight:** 400
- **Color:** `rgba(210, 222, 255, 0.82)` (dark theme)
- **Text shadow:** `0 0 0.6px rgba(120, 160, 255, 0.12)`
- **Line height:** 1.65

These are delivered via `docTheme.ts` (size/color/weight/line-height) and `viewerTokens.css` (text-shadow). 【F:src/document/viewer/docTheme.ts†L21-L30】【F:src/document/viewer/viewerTokens.css†L156-L167】

## Invariants (must not be reintroduced)
- **No transforms/filters/opacity on the scrolling text container.** Keep text out of any parent that applies transform, filter, backdrop-filter, or opacity < 1. (Backdrop blur stays on the sibling backdrop layer only.) 【F:src/document/viewer/DocumentViewerPanel.tsx†L108-L221】【F:src/document/viewer/viewerTokens.css†L39-L52】
- **No heavy shadows on the scrolling layer.** Only the micro AA text-shadow on body text is allowed. 【F:src/document/viewer/viewerTokens.css†L156-L167】
- **No horizontal scroll.** Preserve `overflow-x: hidden` on `.dv-content` and width constraints on the document. 【F:src/document/viewer/viewerTokens.css†L130-L144】
- **Blue-ink family only.** Avoid green/neutral drift in text, borders, or highlights. 【F:src/document/viewer/docTheme.ts†L21-L60】
