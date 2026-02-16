# Gate Error Visibility Run 4 (2026-02-16)

## Scope
- Final hardening and docs sync for explicit gate error visibility contract.

## Files
- `docs/system.md`
- `docs/repo_xray.md`

## Final Contract
1. Gate error is first-class UI:
   - `GraphLoadingGate` shows explicit failure title and runtime message.
2. Error gate exit is explicit:
   - user clicks Back or presses Escape.
   - no automatic redirect away from gate error state.
3. Prompt handoff is secondary continuity:
   - on explicit back from error gate, prompt shows dismissible inline banner.
4. Loading and error semantics remain decoupled:
   - loading from `aiActivity` only
   - error from `aiErrorMessage`

## Verification Notes
- `npm run build` passes after final sync.
- Existing chunk-size warnings remain unchanged and unrelated to this work.
