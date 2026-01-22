# Performance Edge Cases v1 (Document Viewer)
Date: 2026-01-21

Summary: The viewer now scrolls butter-smooth, opens fast, and stays stable under stress.
Progressive doc open and strict scroll contracts eliminate stalls, gaps, and paint spikes.

1) React churn
- Symptom: React commits on every scroll tick.
- Root cause: Unstable props and wide subscriptions.
- Fix: Memoized style props, stable block keys, narrow store usage.
- Invariant / guardrail: Near-zero commits during scroll.
- Where in code: DocumentContent, DocumentBlock, documentModel.
- How to verify: Enable __DOC_VIEWER_PROFILE__ and watch render counters during scroll.

2) Range / virtualization boundary leaks
- Symptom: Pop-in or blank gaps at viewport edges.
- Root cause: Overscan too small or range updates per tick.
- Fix: rAF-throttled range updates, viewport-scaled overscan.
- Invariant / guardrail: NO-BLANK invariant.
- Where in code: useVirtualBlocks.
- How to verify: Fling scroll hard, watch edges for gaps.

3) Measurement / layout thrash
- Symptom: Jitter or layout settle after scroll.
- Root cause: Layout reads during scroll or frequent remeasure.
- Fix: Idle-only measurement, debounce after scroll/resize.
- Invariant / guardrail: MEASUREMENT CONTRACT.
- Where in code: useVirtualBlocks.
- How to verify: Scroll and check for no reflow warnings or settle.

4) Paint / compositor leaks
- Symptom: Scroll feels sticky or GPU-bound.
- Root cause: Shadows/filters on scroll subtree.
- Fix: Remove blur/text-shadow from scroll layer.
- Invariant / guardrail: PAINT-SAFE CONTRACT.
- Where in code: viewerTokens.css, DocumentViewerPanel.
- How to verify: Toggle __DOC_VIEWER_FLAT_VISUALS__ and compare.

5) Text shaping / long-line docs
- Symptom: Long lines cause stalls or horizontal scroll.
- Root cause: Giant text nodes and unbreakable runs.
- Fix: Wrap rules plus chunked spans for long runs.
- Invariant / guardrail: Long-line contract, no horizontal scroll.
- Where in code: DocumentBlock, viewerTokens.css.
- How to verify: Load public/dev-docs/document-viewer-stress.txt.

6) Highlight / search hot-path leaks
- Symptom: Scroll slows with many highlights.
- Root cause: Per-block highlight scanning on every render.
- Fix: Pre-slice highlight ranges per block, defer during hydrate.
- Invariant / guardrail: No highlight work on scroll.
- Where in code: DocumentContent, DocumentBlock.
- How to verify: Apply 500+ highlights and fling scroll.

7) Mode toggle + theme toggle
- Symptom: Toggle causes jump or blanking.
- Root cause: Reflow without anchored remeasure.
- Fix: Schedule idle remeasure on layout version change.
- Invariant / guardrail: Toggle contract, anchor preserved.
- Where in code: DocumentViewerPanel, useVirtualBlocks.
- How to verify: Toggle mode mid-scroll, no jump.

8) Resize and layout shift
- Symptom: Resize causes remeasure storms or gaps.
- Root cause: Resize observer firing without debounce.
- Fix: Debounced resize remeasure, rAF range update.
- Invariant / guardrail: Resize contract.
- Where in code: useVirtualBlocks.
- How to verify: Resize window while scrolling.

9) Background tasks stealing main thread
- Symptom: Scroll stutters with physics running.
- Root cause: Background rAF loops at full rate.
- Fix: Throttle background render loop while viewer scrolls.
- Invariant / guardrail: Main thread budget contract.
- Where in code: useGraphRendering, docViewerPerf.
- How to verify: Run physics and fling scroll.

10) Document load + first paint spikes
- Symptom: Doc open feels frozen, delayed first text.
- Root cause: Full block build before first paint and font load shock.
- Fix: Progressive block builder, perf marks, font preload.
- Invariant / guardrail: Doc open contract (shell -> first content -> hydrate -> idle measure).
- Where in code: DocumentContent, docViewerPerf, workerClient, parsers, index.html.
- How to verify: Open huge doc and time to first text.

Top 10 regression traps
1. Add shadows or filters to the scrolling layer.
2. Read layout in a scroll handler.
3. setState on every scroll event.
4. Rebuild all blocks synchronously before first paint.
5. Overscan too small for fast trackpad flicks.
6. Remount viewer tree on mode/theme toggle.
7. Measure block heights during active scroll.
8. Compute highlights during scroll or first paint.
9. Resize observer attached to every block.
10. Background rAF loops ignore viewer scroll state.

Quick diagnosis ladder
1. Toggle __DOC_VIEWER_FLAT_VISUALS__ and compare smoothness.
2. Enable __DOC_VIEWER_PROFILE__ and check render counters.
3. Check range update rate (rAF-throttled, not per wheel).
4. Confirm measurements only run after idle.
5. Verify background loops throttle when viewer scrolls.
