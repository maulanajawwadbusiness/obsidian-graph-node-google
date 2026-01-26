---
name: soul-to-ui
description: translate maulana’s feeling-language into concrete ui behaviors, micro-interactions, and performance rules.
triggers:
  - "feel like"
  - "human soul"
  - "mother hug"
  - "apple ux"
  - "warmth"
---

# soul-to-ui

## input format
user will describe feelings first (e.g., "like lotus leaf", "warm mom milk at 3am", "too stiff", "too stretchy").

## procedure
1) restate the feeling in 1 sentence.
2) translate into 3 layers:
   - perception layer (what user sees)
   - interaction layer (what user feels on input)
   - timing layer (what must be fast/consistent)
3) map each into concrete ui constraints:
   - easing/no easing
   - latency budget (e.g., <16ms frame, <100ms response)
   - pointer capture rules
   - visual weight (subtle 4×)
4) produce a “ux contract”:
   - must-haves
   - non-goals
   - tests (what should it feel like)

## deliverable
- feeling → interpretation → ux contract
(no code unless asked)
