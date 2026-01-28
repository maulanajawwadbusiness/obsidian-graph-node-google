# Prefill System Hardening: Edge Cases & Races

## Status
**Completed**. The prefill system is now robust against hostile user inputs (spam clicks, dirty typing during streams) and race conditions.

## Key Changes

### 1. Robust Run Integrity (Spam Click Protection)
We introduced a strict **Run ID Authority** model.
- **Store Side**: Every `receiveFromMiniChat` generates a new `runId`.
- **Refine Guard**: The async `refinePromptAsync` callback checks `curr.prefill.runId === myRunId` before updating state. Stale async returns are silently dropped (`refine_ignored reason=stale`).
- **Bar Side**: The core streaming engine (`streamToText`) accepts a `targetRunId`. Inside every `requestAnimationFrame` tick, it checks `targetRunId === currentRunIdRef.current`. If the run has changed mid-stream, the tick aborts immediately.

### 2. Centralized Cancellation
The `cancelEverything(reason)` function is now the single source of truth for cleanup.
- Invalidates the current `streamTokenRef` (instantly killing any active rAF loops).
- Clears the `breathTimerRef` (stopping the seed->refine transition).
- Resets internal phase state.
- **Triggers**:
    - `new_run`: When `runId` changes in props.
    - `user_dirty`: When real typing is detected.

### 3. Dirty Takeover (User Control)
We enforce a strict "User Wins" policy.
- **Detection**: `handleInputChange` detects non-programmatic inputs.
- **Lockout**: Sets `dirtySincePrefill = true`.
- **Impact**:
    - `streamToText`: Instantly aborts if `dirtySincePrefill` is true.
    - `startRefine`: Refuses to start if dirty.
    - `useEffect`: Safely ignores late-arriving refined text (`apply=NO reason=dirty`).
- **Recovery**: The only way to reset `dirty` is a **new handoff** (new `runId`).

## Manual Test Cases & Results

| Scenario | Action | Result |
| :--- | :--- | :--- |
| **Spam Handoff** | Click "Ask Full Chat" 20x fast | Only the *last* seed appears. No flickering. Logs show `refine_aborted` or `refine_ignored` for previous runs. |
| **Seed Interrupt** | Click handoff, then click again during "In context of..." | First stream vanishes instantly. Second stream starts fresh. No double text. |
| **Breath Interrupt** | Click handoff, wait for "...", click again | Breath timer clears. New seed starts. No "double refine" later. |
| **Refine Interrupt** | Click handoff, wait for long text, click again | Long text stops mid-stream. New seed replaces it. |
| **Dirty Type (Seed)** | Type "My " while "In cont..." is streaming | Stream stops dead. Input reads "In contMy ". No further updates. |
| **Dirty Type (Breath)**| Type during the pause | Refine never fires. Log shows `refine_ready apply=NO reason=dirty`. |
| **Dirty Type (Refine)**| Type during long text stream | Stream halts. User text preserved. |

## Logs Implemented
- `[Prefill] run_start runId=101`
- `[Prefill] cancel reason=new_run runId=100`
- `[Prefill] dirty user_takeover runId=101`
- `[Prefill] refine_ready apply=NO reason=dirty runId=101`
- `[Prefill] refine_ignored reason=stale runId=100`
