# Welcome2 Part Latch Refactor

Date: 2026-02-14

## Summary
- Removed double-click and back-chain timing behavior.
- Replaced `[<-]` logic with a part-based restart memory latch.
- Kept `[->]`, deterministic seek flow, and manual-seek auto-advance disable rule.

## Part Terminators
- Part boundaries are split on:
  - `,`
  - `.`
  - `!`
  - `?`
  - `;`
  - `:`
- Trailing whitespace (`space`, `tab`, `newline`) is included in part soft end.

## Mapping Logic
- Current part is resolved from:
  - `probeIndex = max(0, visibleCharCount - 1)`
  - binary search for first `partEndSoftCharCount > probeIndex`

## Latch Logic
- Refs:
  - `lastPartIdxRef`
  - `restartedThisPartRef`
- On part change:
  - reset `restartedThisPartRef = false`
  - update `lastPartIdxRef = currentPartIdx`
- `[<-]` behavior:
  1. First click in part: restart current part (seek to `startMs - 1`, clamped)
  2. Second click in same part: go to previous part and land at about 80 percent inside it
  3. At part 0, stage-2 is no-op

## Preserved Rules
- `[->]` keeps current finish behavior (soft end seek).
- All navigation still uses `seekToMs` deterministic timeline seeking.
- Manual seek still disables auto-advance for current Welcome2 session.

## Verification
- `npm run build` passed.

## Manual Tests
Note: browser interaction tests were not executable in this terminal-only environment.
Please run these 5 manual checks:
1. In part2: click1 `[<-]` restarts part2, click2 `[<-]` goes to part1 at 80 percent.
2. After landing prev part 80 percent: click1 restarts that part, click2 goes further back.
3. Natural typing into next part resets latch so first click restarts the new part.
4. At part 0, second click is no-op and stable.
5. No-click playback cadence is unchanged.
