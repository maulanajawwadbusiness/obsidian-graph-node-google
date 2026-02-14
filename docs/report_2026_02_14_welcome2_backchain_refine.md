# Welcome2 [<-] Back-Chain Refinement Report

Date: 2026-02-14

## Constants
- `DOUBLE_CLICK_MS = 260`
- `CHAIN_WINDOW_MS = 900`

## How Chain Mode Works
- Single click `[<-]`:
  - Restart current sentence.
  - Target time is sentence start minus 1 ms (`startCharMs - 1`) so first char is not already visible.
- Double quick click `[<-]` (within `DOUBLE_CLICK_MS`):
  - Go back one sentence start.
  - Enter back-chain mode until `now + CHAIN_WINDOW_MS`.
- While in back-chain mode (`now < backChainUntilRef`):
  - Each quick `[<-]` click goes back one sentence.
  - Chain window is extended to `now + CHAIN_WINDOW_MS` after each click.
- If pause exceeds chain window:
  - Next `[<-]` returns to single-click behavior (restart current sentence).

## Auto-Advance Safety
- Any manual seek (`[<-]` or `[->]`) marks interaction and disables auto-advance for the current Welcome2 session.
- Timer is still cleared before and after every manual seek.
- Existing typing-phase stale timer clear remains active.

## Manual Test Cases
Note: manual browser interaction could not be executed from this terminal-only run.
The 5 required manual tests are listed for direct UI verification:

1. Single click `[<-]` mid-sentence
   - Expected: jump to same sentence start with first char not pre-visible.
2. Double quick click `[<-]`
   - Expected: land at previous sentence start.
3. Back-chain quick repeated clicks
   - Expected: one sentence backward per quick click while chain window stays active.
4. Pause longer than chain window then click `[<-]`
   - Expected: behavior resets to restart-current-sentence.
5. Boundary and stability
   - Beginning clamp at sentence 0 does not crash.
   - End/hold manual seeks do not trigger surprise auto-advance.
   - Spam click remains stable.

## Build Verification
- `npm run build` passed.
