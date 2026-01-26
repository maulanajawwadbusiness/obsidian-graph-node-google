---
name: repo-grokker
description: scan and model a large repo like a system map. finds where a bug lives across architectures and predicts edge-case cracks.
triggers:
  - "big repo"
  - "hard bug"
  - "architecture"
  - "performance leak"
---

# repo-grokker

## goal
build a mental model of the repo that connects:
- ui/ux symptoms (300ms lag, flicker, stuck hover)
- to architecture-level causes (event routing, bounds, render loop, state lifecycles)
- to specific code seams.

## required inputs (ask if missing)
- entry point (App.tsx/main.tsx)
- the container/layout owner
- the event owners (pointer/wheel/keyboard)
- the render loop owner (rAF)
- any store/context owner

## procedure
1) map the 4 layers:
   - layout/shell layer
   - interaction layer (pointer/wheel)
   - render loop layer (rAF + sizing)
   - state layer (store/context)
2) find the “truth source” for each:
   - size truth (boundingClientRect? resize observer?)
   - pointer truth (target element? capture listeners?)
   - visibility truth (mounted? css hidden? portal?)
3) produce a “system map”:
   - components + ownership + key invariants + hot paths
4) only then propose a fix plan.

## deliverable format
- system map (bullets)
- suspected crack paths (bullets, ranked)
- minimal fix options (2–3)
- tests to prove fix
(no code unless explicitly requested)
