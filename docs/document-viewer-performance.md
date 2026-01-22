# Document Viewer Performance (v1.1)

## Profiling Toggle
Enable lightweight logging by setting this flag in the browser console:

```js
window.__DOC_VIEWER_PROFILE__ = true;
```

This adds:
- Parse timing logs from the document store.
- Block build timing + count in `DocumentContent`.
- Visible range update counters in `useVirtualBlocks` (including per-frame max).
- Render counters for `DocumentContent` and `DocumentBlock`.
- Store update counters firing during scroll.

### Paint/Compositing A/B Toggle
Disable expensive visuals in the viewer only:

```js
window.__DOC_VIEWER_FLAT_VISUALS__ = true;
```

If scrolling becomes "butter" in flat mode, the bottleneck is paint/compositing.

## Render Path (Current)
1. **Document parse (Worker)** → `DocumentStore.parseFile()` dispatches `SET_DOCUMENT`.
2. **Viewer panel render** → `DocumentViewerPanel` renders `DocumentContent`.
3. **Block build** → `DocumentContent` calls `buildBlocks(text)` once per document load (memoized).
4. **Virtualization** → `useVirtualBlocks` calculates visible range + spacers based on scroll.
5. **Block render** → `DocumentBlock` renders only visible blocks.

## Diagnosis (Root Causes + Evidence)
1. **O(n) scroll loop + full DOM re-measure on every render**  
   - The previous virtualization path iterated all blocks on every scroll tick and re-measured blocks every render.  
   - `useVirtualBlocks` now uses prefix height + binary search and only measures when the visible range changes (see perf logs for visible range update counts).

2. **Scroll-driven state churn**  
   - Visible range updates were triggered even when the range didn't change, causing avoidable renders.  
   - `useVirtualBlocks` now compares ranges and avoids state updates when unchanged.

3. **Overly small overscan → pop-in**  
   - Overscan was too small for smooth scroll, causing text "pop in."  
   - Overscan increased to stabilize block mount/unmount boundaries.
4. **Edge flicker under rapid scroll**  
   - Fast scroll would update the visible range with small overscan while height corrections landed mid-scroll.  
   - Result: boundary blocks churned at the top/bottom edge and briefly re-rasterized.


4. **Blank/pop-in during fast scroll (NO-BLANK violation)**  
   - Range windows could shrink too aggressively while new ranges were computed, causing brief empty windows.  
   - Debug logs now capture `scrollTop`, range bounds, and rendered counts; warnings fire if rendered count hits 0.

## Fix Plan (Implemented)
### Memoization Strategy
- `DocumentBlock` is memoized to avoid re-rendering unchanged blocks.
- `buildBlocks(text)` is memoized; timed once per document load.

### Virtualization Strategy
- Prefix height array + binary search replaces the per-scroll full scan.
- Pixel overscan (base + fast tier) ensures stable windowing across scroll speeds.
- Scroll updates are rAF-throttled; range updates only commit when bounds change.
- Block measurement is deferred while scrolling and applied after idle.

### Parsing Strategy
- Parsing runs once per document load inside the worker; logged with timing.

### Scroll Strategy
- Scroll events only update visible range when necessary.
- rAF throttle ensures at most one range update per frame.
- Overscan is pixel-based with a larger buffer during fast scroll.
- Height corrections are deferred while scrolling and applied on idle.

### Paint Strategy
- Heavy shadows removed from the scrolling sheet; borders replace blur shadows.
- Optional flat visuals toggle disables blur/overlays for A/B verification.

## Edge Flicker Guardrail
- Use pixel overscan (base + fast tier) so the buffer scales with velocity.
- Defer block height re-measurements until scroll idle (140ms) to prevent boundary jitter.
- Log overscan tier changes with `__DOC_VIEWER_PROFILE__` to verify fast-scroll behavior.


## Performance Invariants (Must Hold)
- Viewer must **not** rebuild blocks on scroll.
- Viewer must **not** set state on every scroll frame when the range is unchanged.
- Large text parse/build is **O(n) once per load**, not repeated.
- Keys must remain stable and memo boundaries must be stable.
- **NO-BLANK invariant:** visible range must never render an empty window during scroll.

## Butter Scroll Contract
- No layout reads in the scroll loop (height measurements only after idle).
- Only virtual range updates during scroll; no store updates or theme changes.
- Heavy shadows must not sit on the scrolling layer (sheet stays flat).
- Paint-heavy effects (backdrop-filter, gradients, overlays) must be optional for A/B.
