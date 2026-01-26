---
name: perf-60fps-guardian
description: protects 60fps by enforcing measurement-first, hot-path discipline, and anti-stall rules.
triggers:
  - "60fps"
  - "stutter"
  - "lag"
  - "flicker"
  - "perf"
---

# perf-60fps-guardian

## doctrine
no optimization without measurement. no claims without counters.

## procedure
1) identify hot loop(s): rAF, pointermove, wheel, layout, text rendering.
2) add surgical counters (minimal logs) BEFORE changing logic.
3) define budgets:
   - per-frame cpu work must fit <16ms
   - no repeated boundingClientRect calls unless strictly necessary
   - avoid dom mutation in loops
4) propose changes that:
   - reduce work per frame
   - avoid sync layout thrash
   - keep work incremental

## verification checklist
- reproduce stutter before
- counters show spike source
- after fix: counters drop + stutter gone
- no regressions on interaction
