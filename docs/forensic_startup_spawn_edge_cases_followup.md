# Forensic Follow-up: Startup & Spawn Edge Cases

Date: 2026-02-01

## Scope
- Disable early-expansion under `initStrategy=spread` (single continuous law).
- Always-on firewall with startup-only counters.
- Spread seeding spacing based on dot radius and `minNodeDistance`.

## Changes Applied
- Early-expansion now requires `initStrategy=legacy` and `debugAllowEarlyExpansion=true`.
- Firewall clamps `dt` and velocity, and rolls back NaN/Inf to last-good state.
- Startup Audit counters reset on `clear()` and `resetLifecycle()`.
- Spread seeding uses `minSpawnSpacing = max(2*dotRadius+margin, minNodeDistance*0.5, epsilon)` with collision-free placement.

## Notes
- Startup Audit HUD reflects only the current spawn's first 2 seconds.
- Firewall remains active beyond startup but does not increment startup counters.
