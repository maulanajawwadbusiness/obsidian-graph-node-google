# CanvasOverlays Forensics

## Summary
- recorded the regressions found in `src/playground/components/CanvasOverlays.tsx` so we have a traceable forensic for the debug overlay.

## Findings

### 1. Stray `)` after the Fight Ledger block
- **Location**: `src/playground/components/CanvasOverlays.tsx:390-415`
- The `{metrics.renderDebug?.fightLedger && ... }` block already closes at line 413; the additional `)` on line 415 (`)}`) is unmatched and makes the JSX invalid, so the file fails to compile with “Unexpected token )”.
- The fix is to remove the stray `)}` so the constraint fight block becomes the subsequent sibling of the ledger debug panel.

### 2. `SpeedSq Ref` jitter string calls `.toFixed` on the literal `2`
- **Location**: `src/playground/components/CanvasOverlays.tsx:380-383`
- `(metrics.renderDebug.restMarkerStats.epsUsed * 2.5) ** 2 .toFixed(6)` is parsed as `A ** (2.toFixed(6))`, so the UI always prints “2.000000” instead of the actual squared eps value, and the exponent result is never rounded. The intent was clearly `((... ) ** 2).toFixed(6)`. Wrapping the exponent result in parentheses restores the correct value and keeps the string meaningful.

## Notes
- No other typos were blocking compilation, but once the above are resolved the overlay renders again and the jitter numbers become trustworthy.
