# Prefill System V4: Breath + Deterministic Streaming

## Goal
To create a "premium" and calm prefill experience that feels like a natural thought process, not a mechanical fill.

## Key Features
1.  **Deterministic Streaming**: Text appears using a cubic ease-out curve, ensuring consistent timing (not character-based).
2.  **The "Breath"**: A deliberate ~500ms pause after the seed prompt completes. This creates a rhythm of *Initial Thought -> Pause -> Refinement*.
3.  **Run ID Architecture**: Every handoff is a unique "run". Old runs are strictly canceled. Stale async updates are ignored.
4.  **Robust Dirty Guard**:
    -   We distinguish between "user typing" and "programmatic streaming" updates.
    -   If the user types *even one character*, the entire prefill system halts and never touches the input again for that run.
    -   Silent failure: late-arriving refinements on a dirty input are logged but never shown.
5.  **No UI Clutter**: No badges, no "apply" buttons, no "pending" states. Just immediate, calm text.

## Phase Logic
1.  **Seed**: Streams `In context of "Node", continuing...` (~500ms).
2.  **Breath**: Waits ~500ms. No text change.
3.  **Refine**: If refined text is ready (or arrives during breath), it streams in (~700-1200ms based on length).

## Technical Details
-   **Store**: Manages `runId`, `seed`, and `refined` state. Does NOT handle streaming.
-   **Chatbar**: Contains a deterministic state machine (`idle` -> `seed` -> `breath` -> `refine`).
-   **Safety**: Uses `isProgrammaticSetRef` to prevent the streaming engine's own updates from triggering the "user is typing" dirty flag.

## Logs
-   `[Prefill] run_start runId=...`
-   `[Prefill] phase seed|breath|refine`
-   `[Prefill] refine_ready apply=YES|NO`
-   `[Prefill] cancel reason=...`
