# Step 8 Origin Fix Run 5 - Dev Only Bedrock Guardrails

Date: 2026-02-16
Run: r5
Scope: add low-noise dev sanity checks for boxed viewport measurement correctness.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Added dev warn-once for boxed tiny/missing viewport after mount:
   - timer at 600ms after observer setup in boxed mode.
   - warns if width/height still `<=1` or bounds are missing.
2. Added dev warn-once origin sanity check in flush:
   - warns if computed boxed bounds origin is `(0,0)` while current BCR origin is non-zero.
3. All warnings are gated by `import.meta.env.DEV` and warn once only.

## Outcome

- catches stuck or regressed measurement paths without affecting production runtime behavior.

## Verification

- `npm run build` passes.
