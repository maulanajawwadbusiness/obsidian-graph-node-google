# Step 3 Run 5 - Hardening Note

Date: 2026-02-04

## Change
- Added a defensive fallback in `topologyControl` so `getTopology()` derives springs when links exist but springs are missing. This hardens the split against future call-site mistakes without changing the primary mutation seam.

## Why
- Even with `setTopology()`/`patchTopology()` recomputing springs, a future caller could accidentally clear springs or bypass the normal mutation flow. This fallback ensures the physics layer stays consistent when `getTopology()` is used for inspection or wiring.

## Expected Behavior
- If `links.length > 0` and `springs` is empty, `getTopology()` triggers a one-time derive using default physics config and logs a dev warning.
- Normal paths (`setTopology`/`patchTopology`) still recompute springs as before.

## Verification
- In dev console, run `window.__kg_proof()` and confirm the log shows springs derived even if springs were missing.
- Ensure XPBD constraint count matches springs count.
