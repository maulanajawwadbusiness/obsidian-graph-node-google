# Step 3 Hardening Run 15: Final Docs + Verification Bedrock

Date: 2026-02-15
Scope: Finalize documentation for strict sample preview restore flow.

## File updated

- `docs/system.md`

## Added documentation

1. New section: `2.8 Sample Preview Restore Hardening (2026-02-15)`
2. Canonical step-by-step preview pipeline with exact file ownership
3. Explicit rule: no silent empty-topology coercion in strict preview path
4. Swap-sample procedure for future agents
5. Error UI behavior contract
6. Manual verification checklist for valid and invalid sample scenarios

## End-state summary

- Preview path is now explicit fail-closed with structural + semantic gating.
- Runtime mount happens only after full validation success.
- Invalid sample remains contained and visible through coded error UI.