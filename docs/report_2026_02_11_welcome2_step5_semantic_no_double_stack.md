# Welcome2 Step 5: Semantic No-Double-Stack

Date: 2026-02-12
Branch: wire-typing-smoothness
Commit scope: semantic exclusivity guarantees and debug proofing in timeline build.

## Final Semantic Priority Ladder

Boundary semantic category is now single-source and exclusive:

1. marker
2. landing
3. heavyWord
4. word
5. none

Additional non-semantic boundary labels used for reporting only:
- newline
- paragraph

## Invariants Locked

- Letters and digits are mechanical-only timing; semantic pause must stay 0.
- Semantic timing writes only to boundary indices in `semanticPauseByIndex`.
- Each boundary index resolves to exactly one semantic category in `semanticCategoryByIndex`.
- Marker boundaries suppress semantic (`semanticPauseMs` forced to 0).
- Semantic pause per boundary is clamped to `MAX_SEMANTIC_BOUNDARY_MS` (220 ms).

## What Changed

File: `src/screens/welcome2Timeline.ts`

- Added explicit semantic source model:
  - `SemanticBoundaryCategory` now includes `none|word|heavyWord|landing|marker|newline|paragraph`.
  - `SemanticSourceFlags` tracks raw source attempts (`word/heavyWord/landing/marker`) per index.
- Added single-source resolver path:
  - `assembleSemanticBoundaryPauses(...)`
  - `resolveSemanticCategory(...)`
  - `getSemanticPauseForCategory(...)`
- Replaced implicit additive semantic writes with resolved single-write semantics per boundary index.
- Added conflict diagnostics:
  - Logs `[Welcome2Cadence][SemanticConflict]` when multiple semantic sources target one boundary (debug only), while still resolving by priority.
  - Logs hard violations for clamp overflow and marker-with-semantic.
- Preserved single-rail letter timing and added cross-checks in existing debug sample output.
- Added synthetic debug scenario pass (debugCadence only) for:
  - `this is very INTUITIVE.`
  - `this is very INTUITIVE.{p=260}`
  - `this is simple.`
  - `INTUITIVE KNOWLEDGE MEDIUM.`
  - `first line.\n\nsecond line.`

## Debug Output Snippets (New)

The timeline now emits structured rows including semantic category and source counts for synthetic scenarios:

```txt
[Welcome2Cadence] synthetic scenario=heavyBeforePunct boundary rows=[
  { index: 4, char: " ", class: "space", semanticPauseMs: 14, semanticCategory: "word", sourceCount: 1, flags: ... },
  { index: 22, char: ".", class: "punct", semanticPauseMs: 135, semanticCategory: "landing", sourceCount: 2, flags: ... }
]
```

```txt
[Welcome2Cadence][SemanticConflict] label=heavyBeforePunct index=22 char="." flags={word:true, heavyWord:true, landing:true, marker:false} resolvedCategory=landing semanticPauseMs=135 textSlice="..."
```

```txt
[Welcome2Cadence][Violation] scenario=... semantic pause on letter/digit ...
```

If this third violation line appears, that is a hard invariant break.

## Marker Suppression Guarantee

For marker boundaries (`{p=...}`), semantic category resolves to `marker` and semantic pause is forced to 0.
Any non-zero semantic on marker boundaries logs a violation.

## Why This Is Safe For Current rAF + Rounding Setup

The change does not alter event time progression math. It only replaces semantic source accumulation with a deterministic single-source resolution before `pauseAfterMs` is applied. This keeps monotonic timeline behavior intact while removing hidden semantic double-stacks.
