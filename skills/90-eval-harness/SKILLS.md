---
name: eval-harness
description: creates a small suite of “golden tasks” to prevent agent drift and enforce reliability over time.
triggers:
  - "standardize"
  - "24 hour"
  - "again again"
  - "reliable"
---

# eval-harness

## goal
turn “magic-like” into repeatability by testing.

## procedure
1) collect 10 golden tasks:
   - 3 ui layout
   - 3 perf regressions
   - 2 bug repros
   - 2 backend changes
2) define pass/fail for each.
3) require agent to run through checklist before claiming success.

## deliverable
- golden task list
- pass/fail definitions
- minimal automation hooks
