# Step 10 Wheel Bleed Fix Run 7

Date: 2026-02-16
Scope: performance hardening for wheel consumer detection

## Changes

File: `src/components/sampleGraphPreviewSeams.ts`

1. Added overflow capability cache.
- `WeakMap<HTMLElement, { vertical, horizontal }>` caches whether element overflow settings are scroll-capable by axis.
- avoids repeated `getComputedStyle` reads for same elements across frequent wheel events.

2. Retained strict short-circuiting.
- helper exits early when `deltaX === 0 && deltaY === 0`.
- ancestor walk remains bounded to overlay root.

3. Kept explicit scrollable-marker fast path.
- marked scroll containers are checked first without computed-style reads.
- fallback style-based scan still exists for unmarked paths.

## Why

- reduces per-wheel overhead without adding polling.
- keeps detection deterministic and bounded within overlay subtree.

## Run 7 verification

- `npm run build` executed after changes.