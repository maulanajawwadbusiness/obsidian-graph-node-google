# Report 2026-02-08: Welcome1 Quicksand Blink Forensic Scan

## Scope
This report captures only scan and analysis work for the Welcome1 font blink issue.
No implementation changes are included in this report.

## Problem Statement
On first load of onboarding Welcome1, text renders briefly in fallback font and then switches to Quicksand.
Observed behavior matches a visible FOUT window of roughly hundreds of milliseconds.

## Files Scanned
- `src/styles/fonts.css`
- `src/main.tsx`
- `index.html`
- `src/screens/AppShell.tsx`
- `src/screens/Welcome1.tsx`
- `src/screens/Welcome2.tsx`
- `src/screens/EnterPrompt.tsx`
- Global search on `src/` and `docs/` for font loading and `document.fonts` usage

## Findings

### 1) How Quicksand is loaded
Quicksand is loaded as a local font via CSS `@font-face`.

Evidence:
- `src/styles/fonts.css:2` declares `@font-face` for `Quicksand`
- `src/styles/fonts.css:4` source is `../assets/Quicksand-Light.ttf`
- `src/styles/fonts.css:7` uses `font-display: swap`
- `src/main.tsx:7` imports `./styles/fonts.css` globally

Conclusion:
- Font fetch is asynchronous at runtime from local TTF asset.
- There is no dedicated startup gate tied to font readiness for onboarding.

### 2) Where Welcome1 references Quicksand
Welcome1 text and related styles rely on `var(--font-ui)`, which resolves to Quicksand.

Evidence:
- `src/styles/fonts.css:21` sets `--font-ui: 'Quicksand', ...`
- `src/screens/Welcome1.tsx:181` title uses `fontFamily: 'var(--font-ui)'`
- `src/screens/Welcome1.tsx:197` subtitle uses `fontFamily: 'var(--font-ui)'`
- `src/screens/Welcome1.tsx:251` fullscreen prompt card style uses `fontFamily: 'var(--font-ui)'`
- `src/screens/Welcome1.tsx:288` primary prompt button uses `fontFamily: 'var(--font-ui)'`
- `src/screens/Welcome1.tsx:300` secondary prompt button uses `fontFamily: 'var(--font-ui)'`

Conclusion:
- Welcome1 first paint depends directly on Quicksand availability.

### 3) Why the blink happens
The active `font-display: swap` policy allows immediate fallback rendering before Quicksand finishes loading.
Once loaded, browser swaps glyphs, causing visible blink.

Evidence:
- `src/styles/fonts.css:7` has `font-display: swap`
- `index.html` has no font preload hint for Quicksand
- No onboarding font readiness gate found in `AppShell` or `Welcome1`
- Repo-wide scan found no existing Welcome1/Onboarding `document.fonts.load` gate

Conclusion:
- Root cause is startup paint occurring before Quicksand ready, combined with swap behavior.

### 4) Existing font readiness usage elsewhere
A font readiness listener exists in graph rendering logic only, not onboarding.

Evidence:
- `src/playground/rendering/graphRenderingLoop.ts:623` to `:625` uses `document.fonts.ready` and `loadingdone`

Conclusion:
- Current codebase has precedent for Font Loading API usage, but onboarding does not use it.

### 5) Best render-gate location (structural)
Best place to gate Welcome1 mount is in AppShell screen branch selection, before rendering `Welcome1`.

Evidence:
- `src/screens/AppShell.tsx:91` begins `if (screen === 'welcome1')` branch
- Welcome1 is mounted directly there and fullscreen button is also composed there (`src/screens/AppShell.tsx:99`)

Why this is best:
- Clean mount gate, not visual overlay.
- Prevents previous "blank overlay seeping" issue because Welcome1 subtree is not mounted at all while waiting.
- Keeps behavior centralized in onboarding screen router.

## What is not causing the blink
- Not caused by Google Fonts network link (none used for Quicksand).
- Not caused by Welcome1 inline style mismatch (it correctly references shared `--font-ui`).
- Not caused by EnterPrompt/Login overlay stack changes.

## Minimal Diff Recommendation (Plan-Only)
1. Add Quicksand readiness state using Font Loading API (`document.fonts.load('1em "Quicksand"')`) with 1500ms timeout.
2. Apply gate at AppShell `screen === 'welcome1'` branch.
3. While waiting, return a pure blank full-screen branch (`#06060A`) and do not mount Welcome1.
4. If ready before timeout, mount Welcome1 normally.
5. If timeout hits, proceed with Welcome1 (best effort fallback).
6. Add dev-only logs:
- `font_check_start`
- `font_ready_ms=<value>`
- `font_timeout_ms=1500 proceed`

## Acceptance Criteria for Future Implementation
- Hard refresh in dev: no fallback font visible on Welcome1.
- Either blank screen briefly then Welcome1 in Quicksand, or immediate Welcome1 in Quicksand.
- No overlay-based masking layer is used.

## Risk Notes
- `font-display: swap` remains global behavior for Quicksand; gating only controls Welcome1 entry experience.
- If other screens mount before font readiness, they may still show fallback unless similarly gated.

## Final Forensic Verdict
The Welcome1 blink is a predictable FOUT from `font-display: swap` plus lack of mount gating.
The clean fix seam is AppShell Welcome1 branch gating, not overlay masking inside Welcome1.
