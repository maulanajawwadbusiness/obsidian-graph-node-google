# Fix XPBD Repulsion Default: Config Logic (Repair)

**Date**: 2026-02-02
**Goal**: Ensure `xpbdRepulsionEnabled` defaults to `true` while restoring `xpbdLinkCompliance`.

## Changes

### 1. `src/physics/config.ts`
Restored `xpbdLinkCompliance: 0.01` which was accidentally deleted in the previous edit.
Ensured `xpbdRepulsionEnabled: true` remains.

## Verification
- **Code Check**: Verified lines 179-183 contain both keys.

## Risks
- None. Repair only.
