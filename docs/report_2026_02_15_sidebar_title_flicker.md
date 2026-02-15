# Report: 2026-02-15 Sidebar Session Title Flicker Forensic

## 1. Scope and Method

This run is forensic instrumentation plus cause isolation setup, not final behavior fix.

Files changed in this run:
- `src/components/Sidebar.tsx`

Forensic instrumentation added behind a hard flag:
- `SIDEBAR_FLICKER_DEBUG = false`
- `SIDEBAR_FLICKER_DEBUG_SWITCHES` for isolate tests

No pointer or wheel shielding was changed.

## 2. Repro Matrix

### Cases requested

| Case | Status in this run | Observation path |
| --- | --- | --- |
| Expand with mouse not over sidebar | Instrumented | `logFrames` captures first 20 frames after toggle |
| Expand with mouse parked over session row | Instrumented | `disableHoverResetOnMotionStart` isolates hover reset effect |
| Expand at 100/110/125 percent zoom | Instrumented | frame logs include `cw/sw` and sidebar width for churn analysis |
| Long title vs short title | Instrumented | first row title metrics (`clientWidth`, `scrollWidth`) tracked |

Note:
- This environment does not provide interactive browser control, so visual execution for the matrix is prepared but not directly executed in-terminal.
- The instrumentation is ready to collect deterministic logs in-app with one toggle action per run.

## 3. Classification Decision (A/B/C/D/E)

Primary classification: **C) ellipsis churn**.

Secondary contributors:
- **A) opacity flash** risk at transition boundary due phase timing (`useEffect`-driven motion phase update).
- **D) hover-state flicker** when mouse is parked over a row and motion-start effect clears hover ids.

Why C is primary:
1. Session titles are visible during `expanding` (`shouldShowSessionTitles` includes expanding).
2. Sidebar width animates continuously during expand.
3. Session title lane is single-line ellipsis (`whiteSpace: nowrap`, `textOverflow: ellipsis`), so visible tail can churn while available width changes frame-by-frame.
4. Earlier attempt that removed per-title choreography but left titles visible during expand made flicker perceptually worse, consistent with pure ellipsis-churn exposure.

## 4. Evidence (Code-Level + Probe Outputs)

### Deterministic code evidence

- Session title visible during expanding:
  - `src/components/Sidebar.tsx` -> `shouldShowSessionTitles = motionPhase === 'expanding' || motionPhase === 'expanded'`
- Session title reveal still includes transform and opacity:
  - `sessionTitleRevealStyle` uses `opacity + transform + transition`
- Motion phase set in `useEffect`:
  - potential one-paint phase lag after `isExpanded` flip
- Hover clear on motion start:
  - `setHoveredInterfaceId(null)` and `setHoveredEllipsisRowId(null)` in motion-start effect
- Title lane is ellipsized single-line:
  - `INTERFACE_TEXT_STYLE` uses `overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap`

### Instrumentation log format added

Per toggle, first ~20 rAF frames emit:
- `isExpanded`, `motionPhase`, `showTitles`
- title computed `opacity`, `transform`, `textOverflow`, `color`
- title `cw/sw`
- sidebar width snapshot
- hovered row ids

Log prefix:
- `[sidebar-flicker]`

Short sample shape:
```text
[sidebar-flicker] seq=1 frame=1 dir=expand isExpanded=1 motionPhase=collapsed showTitles=0 opacity=0 transform=matrix(...) cw=... sw=... overflow=ellipsis ...
[sidebar-flicker] seq=1 frame=2 dir=expand isExpanded=1 motionPhase=expanding showTitles=1 opacity=1 transform=matrix(...) cw=... sw=... overflow=ellipsis ...
```

What this proves when run:
- A boundary flash exists if frame1/2 flips hidden->shown.
- C churn exists if `cw` changes across frames while `sw` remains stable and text is visible.
- D exists if parked-hover case flips color/hover ids at motion start.

## 5. Isolate-by-Switch Tests Added

All switches are debug-only and off by default.

1. `showTitlesExpandedOnly`
- hides titles during `expanding`; shows only in `expanded`.
- If flicker disappears, in-flight visibility is a direct cause.

2. `removeTitleTransform`
- removes per-title translate transform, keeps opacity gating.
- If jitter drops, transform contributes to perceived wobble.

3. `forceTitleOverflowClip`
- uses `textOverflow: clip` for titles.
- If flicker drops, ellipsis churn is confirmed as primary mechanism.

4. `disableHoverResetOnMotionStart`
- preserves hover ids during motion start.
- If parked-mouse flicker drops, hover reset is a contributor.

## 6. Root Cause Statement

Single sentence:
- **Session title flicker is primarily caused by ellipsis churn while the title remains visible during sidebar width interpolation, amplified by phase-boundary visibility flips and hover reset side effects.**

Deeper explanation:
- Width animation changes text clipping boundary every frame.
- Because titles are visible during `expanding`, truncation edge and tail glyphs keep changing.
- Additional opacity/transform and phase/hover boundary changes add brief perceptual flashes at transition start.

## 7. Fix Options Ranked by Guaranteed No Flicker

1. **Guaranteed**: keep session titles hidden for entire `expanding` and `collapsing`; reveal only after `motionPhase === 'expanded'` with opacity-only transition.
2. **Near-guaranteed**: keep titles visible during expand but remove ellipsis during motion (`clip`), re-enable ellipsis only when settled.
3. **Medium**: keep current visibility but remove per-title transform and move motion phase update to pre-paint (`useLayoutEffect`).
4. **Low**: only tune easing/duration; does not remove clipping-boundary churn source.

## 8. Recommended Minimal Patch (not implemented in this run)

- `shouldShowSessionTitles = motionPhase === 'expanded'`
- session title reveal = opacity-only (no translate)
- keep `INTERFACE_TEXT_STYLE` stable single-line lane
- change motion-phase hook to `useLayoutEffect` to remove first-frame phase lag
- keep hover reset behavior for non-row controls but avoid forced row-hover clear if it reintroduces visual color flicker

This path is the smallest deterministic change set with highest probability of zero session-title flicker.

## 9. Commit(s)

- `034692c` `chore(sidebar): add flicker forensic debug probes and isolate switches`
