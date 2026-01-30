# Docs Refresh: System, Handoff, Agents

## 1. Summary
Refreshed `docs/system.md`, `docs/handoff.md`, and `AGENTS.md` to reflect the "0-Slush" physics doctrine, the Hybrid Solver architecture, and current AI/Interaction contracts.

## 2. Key Updates

### A. System (`docs/system.md`)
*   **Physics Architecture**: Explicitly defined the **Hybrid Solver** (Forces + PBD + Diffusion).
*   **0-Slush Scheduler**: Documented the "Brief Stutter" (Drop Debt) failure mode.
    *   *Rule*: `accumulatorMs` is hard-reset if budget is exceeded. No "syrup" allowed.
*   **Performance**: Added summaries of Edge Fixes 01-12 (Strided Sampling, Dense Clamps, Phase Staggering).
*   **Dt-Normalization**: Added note on stiffness invariance.
*   **Logs**: Updated telemetry list (`[PhysicsSlushWarn]`, `[RenderPerf]`).

### B. Handoff (`docs/handoff.md`)
*   **Payload V2**: Confirmed `content: { title, summary }` is the key context carrier.
*   **Priority Rule**: Explicitly stated `pendingContext > activeDocument`.
*   **Prefill Integration**: Noted that "Refine Packet" uses the passed `content` summary for better V4 prompts.

### C. Agents (`AGENTS.md`)
*   **Constitution**: Added "0-Slush" and "Drop Debt" to the core doctrine.
*   **Perf Doctrine**: formalized Bounded Work and Adaptive Gating rules.
*   **Interaction**: Added "Drag Authority" (1:1 movement) and "Wake-on-Drag".
*   **Safety**: Explicitly forbade browser testing tools.

## 3. Repo Truths Confirmed
*   **Physics Loop**: `tick()` uses `applySafetyClamp` (PBD) and `applyForcePass` (Forces).
*   **Scheduler**: `useGraphRendering.ts` implements the drop-debt logic (`droppedMs += accumulatorMs`).
*   **AI**: `prefillSuggestion.ts` consumes `content` for the prompt builder.
*   **Logging**: `[RenderPerf]` and `[PhysicsPerf]` are the primary debug signals.

## 4. Why This Matters
Future agents will now know that "Syrup" is a regression, not a feature. They will know exactly which logs to check (`[PhysicsSlushWarn]`) and how interaction authority works ("Hand wins").
