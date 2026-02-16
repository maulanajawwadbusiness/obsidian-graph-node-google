# Step 5+7 Hardening Run 10 - Final Bedrock Check

Date: 2026-02-16
Run: r10
Scope: strictmode/invariant audit and readiness confirmation for next viewport steps.

## Strictmode/lifecycle audit

1. `useGraphPaneViewportSnapshot` safety
- file: `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`
- effect runs one-shot per mount and uses local `disposed` guard.
- state update path is guarded against post-unmount writes.
- no subscriptions/observers/timers are introduced in this step.

2. `resourceTracker` negative-count invariant
- file: `src/runtime/resourceTracker.ts`
- decrements that would go below zero now clamp at `0`.
- first invalid decrement per resource warns once with short stack context.
- unbalanced warning dedupe now warns once per source.

## Acceptance closure for requested audit items

A) Resource tracker hardening
- dev counts cannot remain negative.
- invalid decrements are explicit (warn once) and non-silent.

B) Graph-screen viewport source
- provider no longer uses only window snapshot.
- app graph path now resolves from graph pane container snapshot after first layout pass.

C) Provider placement
- graph provider scope now includes `GraphLoadingGate` and graph runtime.

## Readiness for step 8/9

- Step 8 can now replace one-shot pane snapshot with ResizeObserver updates.
- Step 9 clamp migrations can rely on app graph viewport coming from real pane geometry.
