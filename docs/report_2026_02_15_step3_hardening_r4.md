# Step 3 Hardening Run 4: Strict Adapter Default (No Silent Topology Coercion)

Date: 2026-02-15
Scope: Remove silent topology fallback from adapter default behavior.

## File changed

- `src/lib/devExport/devExportToSavedInterfaceRecord.ts`

## Behavior change

Previous behavior:
- Missing/malformed topology was silently converted to empty topology.

New behavior:
- Adapter is strict by default.
- Missing topology throws: `DEVEXPORT_TOPOLOGY_MISSING`.
- Invalid topology shape throws: `DEVEXPORT_TOPOLOGY_INVALID`.

Lenient opt-in:
- Added adapter option: `allowEmptyTopology?: boolean`.
- When explicitly true, legacy empty-topology fallback is still available.
- Default is strict (no coercion).

## Impact

- Preview path now receives explicit adapter failure for critical topology absence/invalid shape.
- Silent blank graph conversion is removed from default adapter behavior.