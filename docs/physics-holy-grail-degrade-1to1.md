# Physics Holy Grail: Degrade 1:1 (No Mud)

Date: 2026-01-30

## Scandissect Summary
- Scheduler + overload metrics live in `src/playground/useGraphRendering.ts`.
- Physics pass sequencing is in `src/physics/engine.ts` with heavy passes in `forcePass`, `constraints`, and `corrections`.
- Drag authority path uses `applyDragVelocity` before integration.
- Pairwise work is throttled via `pairStride` in `forces.ts` and `constraints.ts`.

## Bucket Classification Used
- Bucket A (never degrade): drag/hand authority path, core integration, release cleanup.
- Bucket B (structure): repulsion/collision/springs/spacing/triangle constraints, safety clamp, edge relaxation.
- Bucket C (polish): micro-noise + diffusion breadth (de-locking, decoherence, diffusion neighbor range).

## Degrade Policy (Deterministic)
- **Degrade levels** set by scheduler overload state: 0 (normal), 1 (soft), 2 (hard). Source is overload severity; hold frames keep degrade active briefly on recovery.
- **Frequency reductions** (deterministic via `frameIndex % k`):
  - repulsion/collision/springs: k=1/2/3 for levels 0/1/2.
  - spacing: base frequency * k (base from perfMode).
  - triangle: k=1/2/4.
  - safety clamp: k=1/2/3.
  - edge relaxation: k=1/2/3.
  - micro passes (de-locking/decoherence/etc.): k=1/2/4.
- **Neighborhood reduction**: pairwise budgets reduce via `pairStride` scaling (0:1.0, 1:0.7, 2:0.4).
- **Diffusion range reduction**: neighbor diffusion is capped to first N neighbors (N=all/4/2 by level). Correction strength is unchanged.
- **Locality boost**: when dragging or shortly after release, a small focus set (dragged dot + direct neighbors) gets forced collision/spacing even if global passes are skipped.

## Observability
- `[Degrade] level=.. reason=.. budgetMs=.. passes={...} k={...} pairBudget={...}`
- `[Hand] dragging=.. localBoost=.. lagP95Px=..`

## Validation Evidence (Expected Logs)
```
[Degrade] level=1 reason=BUDGET_EXCEEDED budgetMs=12.0 passes={repel:N coll:Y space:N spring:N tri:N safety:Y diff:Y micro:N} k={repel:2 coll:2 spring:2 space:4 tri:2 safety:2 micro:2} pairBudget={pairStride:4 spacingStride:6}
[Hand] dragging=Y localBoost=Y lagP95Px=0.00
```

## Remaining Known Risks
- If per-tick cost is consistently higher than `maxPhysicsBudgetMs`, the system will stutter more often (still no syrup).
- Locality boost only uses direct link neighbors; non-linked nearby dots may still be updated less frequently under heavy overload.

## Repro Steps
1) Enable `debugPerf` and optional `debugStall`.
2) Trigger stall (40-80ms): ensure degrade rises and logs appear; no slow-motion tail.
3) Drag under overload: verify `[Hand]` log shows near-zero lag and localBoost=Y.
4) Observe recovery: degrade level returns to 0 after hold frames without snapping.
