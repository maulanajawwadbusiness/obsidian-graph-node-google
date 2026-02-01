# XPBD Iteration Budget Run 5: Validation & Tuning

## Goal
Validate that increased iteration counts during drag (6) vs idle (2) provide the desired "stronger propagation" without introducing instability.

## Acceptance Tests

### Test A: Propagation (The "Tug" Test)
- **Setup**: N=60 graph.
- **Action**: Grab a node and drag it slowly for 2 seconds.
- **Expectation**: 
    - Immediate neighbors (1-hop) follow closely.
    - Secondary neighbors (2-hop) and tertiary (3-hop) show visible displacement.
    - `iter` HUD shows `6` (or `6 (cfg: 2/6)`).
- **Result**: Defaults (Drag=6) provide significantly stiffer local response than Single-Pass (1).

### Test B: Release Settle
- **Setup**: Drag a node to stretch the graph, then release.
- **Action**: Watch the settle behavior.
- **Expectation**:
    - `iter` HUD drops to `2` (or `2 (cfg: 2/6)`).
    - Graph relaxes smoothly.
    - `earlyBreak` count increases as system stabilizes (iterations used might drop to 1).
- **Result**: System stabilizes efficiently. `Idle=2` allows 2x faster convergence than legacy, but `earlyBreak` prevents wasting cycles on fully settled graphs.

### Test C: Cross-Count
- **Setup**: Switch between N=20 and N=60.
- **Action**: Observe "stiffness" feel.
- **Expectation**: Consistent behavior. XPBD compliance is physically based (independent of N, dependent on `alpha`), so iterations just ensure constraint satisfaction.
- **Result**: Consistent.

## Tuning Decisions
- **Idle Iterations**: Set to **2**.
    - Rationale: Single pass is often "mushy". 2 passes resolves simple oscillating pairs better. Stagnation guard prevents waste.
- **Drag Iterations**: Set to **6**.
    - Rationale: 6 iterations allows ~6 hops of signal propagation per frame (at stiff compliance). This fits the user requirement "2-3 hops visibly respond" comfortably.
    - Safety: Hard capped at 12.

## Final Configuration
```typescript
xpbdIterationsIdle: 2
xpbdIterationsDrag: 6
xpbdMaxCorrPerConstraintPx: 100
MAX_ITERATIONS_HARD_CAP: 12
```

## Conclusion
The iteration budget system is fully implemented, guarded, and instrumented.
