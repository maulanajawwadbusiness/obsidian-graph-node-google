# Prefill System Fail-Safes: "It Just Works" Coverage

## Status
**Completed**. The prefill system is now protected by a final layer of fail-safes that guarantees it never hangs, crashes, or fights the user, regardless of network/async/browser chaos.

## Fail-Safes Implemented

### 1. Global Hard Timeout (Run Integrity)
- **Mechanism**: A 3000ms timer starts with every new run.
- **Why**: If a breath timer hangs, or a refine promise never resolves, or a visibility throttle goes wrong, this timer acts as the "Ghostbuster".
- **Action**: If triggered, it cancels all animation and Forces a **Snap to Stable**.
- **Result**: The user never sees a "..." thinking state last forever.

### 2. Snap to Stable (Anti-Ghost)
- **Mechanism**: A centralized helper `snapToStable(reason)` that determines the best deterministic text (Refined > Seed) and commits it instantly.
- **Why**: We need a single source of truth for "stopping and being safe".
- **Usage**: Called on Hard Timeout, Visibility Hidden, Resize Start, and Uncaught Errors.

### 3. Try/Catch Tick Guard (Anti-Crash)
- **Mechanism**: The entire `requestAnimationFrame` body is wrapped in `try/catch`.
- **Why**: DOM errors (e.g., accessing style on null element) or logic bugs inside the loop could crash the React tree.
- **Action**: On error, log `[PrefillError]`, cancel loop, and Snap to Stable. The app stays alive.

### 4. Mounted Ref (Anti-Leak)
- **Mechanism**: `isMountedRef` tracks component lifecycle.
- **Why**: Prevents "Can't perform a React state update on an unmounted component" warnings if callbacks fire after closing the chatbar.
- **Action**: All callbacks (stream tick, timeout, refine apply) check `!isMountedRef.current` and return early if false.

## Manual Test Cases

| Scenario | Action | Result |
| :--- | :--- | :--- |
| **Simulated Freeze** | Comment out `onDone()` so stream never finishes | Hard Timeout fires at 3s. Input snaps to full text. UI is unlocked. |
| **Crash in Loop** | Throw error inside `streamToText` | Error caught. Loop stops. Text snaps. No white screen of death. |
| **Close mid-stream**| Close chatbar while typing | No console warnings. Cleanup runs silently. |
| **Refine Hang** | Refine never returns | Hard Timeout fires. Input snaps to Seed (or Refined if partial). |

## Logs Implemented
- `[PrefillRun] runId=... end=snapped reason=hard_timeout`
- `[PrefillError] tick_failed runId=...`
- `[PrefillWarn] hard_timeout fired`
