---
name: bug-hunter-edgecase
description: hunts faint, indirect, future-crack edge cases (race, lifecycle, stale refs, capture vs bubble, portal layering).
triggers:
  - "unbreakable"
  - "frail"
  - "sometimes"
  - "only on some pdf"
  - "random"
---

# bug-hunter-edgecase

## procedure
1) list top 10 edge-case classes:
   - stale refs
   - async races (worker/parse/render)
   - event propagation leaks (pointer/wheel)
   - portal z-index overlaps
   - layout resize 1-frame mismatch
   - hydration/strictmode double-invoke
   - debounced input drop
   - text mismatch offsets
   - selection/highlight dom assumptions
   - error swallowing / silent no-op
2) pick the top 3 most likely and trace call chain.
3) propose a fix with:
   - guardrails
   - explicit fail states
   - deterministic tests

## deliverable
- “why it breaks” narrative (short)
- fix strategy
- verification steps
