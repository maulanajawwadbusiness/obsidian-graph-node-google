# Forensic Report Phase 3: Loop Gating Failure

## Evidence
- **SEEN**: `[HoverDbg] Input Active` (Handler works, sets `pending=true`).
- **NOT SEEN**: `[HoverDbg] Gate` (Loop never logs the gate check).
- **NOT SEEN**: `hover:` (Hit test never runs).

## Analysis

### 1. Loop Is Running (Previously Confirmed)
Earlier reports confirmed `[HoverDbg] Loop Check` was visible.
The new P1 `Gate` log was inserted *inside* the loop.
If `Gate` is missing, execution is **skipping the P1 log block**.

### 2. The P1 Guard
The P1 log is guarded by:
```typescript
if (theme.hoverDebugEnabled && now - lastGateLog > 1000) { ... }
```
If this never prints, then either:
- **A. `theme.hoverDebugEnabled` is FALSE** (Most Likely).
- **B. `lastGateLog` is in the future** (Time travelers?).
- **C. Loop crashed/stopped** before this line.

### 3. Stale Theme Hypothesis
`startGraphRenderLoop` is called once in `useEffect`.
It receives `config` and `settingsRef`.
IT DOES NOT receive `theme` as a dynamic ref, but usually as a value or via `settingsRef`.

**CRITICAL FINDING**:
In `useGraphRendering.ts`:
```typescript
const stopLoop = startGraphRenderLoop({
    ...
    // theme? It is NOT passed to startGraphRenderLoop explicitly in earlier checks!
    // It usually comes from settingsRef or derived?
});
```
Wait, inspecting `graphRenderingLoop.ts` signature:
```typescript
export const startGraphRenderLoop = (deps: GraphRenderLoopDeps) => { ... }
```
Does `GraphRenderLoopDeps` contain `theme`?
Or does it calculate theme inside the loop?

If the loop uses a **closure-captured `theme`** from the moment of start (mount), and the user toggled debug AFTER mount:
- The loop holds the OLD theme (debug=false).
- The handler holds the NEW theme (debug=true) or reads fresh state.

Actually, `theme` is usually derived from `settingsRef.current.skinMode` inside the loop.
Code check: `const theme = getTheme(settingsRef.current.skinMode);`
If the loop does this **every frame**, it gets the fresh value.
If the loop does this **once at setup**, it is STALE.

### 4. Code Review (Simulated)
In `graphRenderingLoop.ts`:
```typescript
const render = () => {
   // ...
   const theme = getTheme(settingsRef.current.skinMode); // <--- Should be here
   // ...
   if (theme.hoverDebugEnabled ... ) log Node;
}
```
If the P1 log uses a *captured* theme variable from outside `render()` function scope, it is stale.

## Conclusion
The `[HoverDbg] Gate` log is likely missing because **`theme.hoverDebugEnabled` evaluates to false inside the loop**.
This happens if `theme` is not refreshed from `settingsRef` every frame, or if `settingsRef` is not updating correctly.

## Verification Plan
1.  Check `graphRenderingLoop.ts` to see where `theme` variable comes from.
2.  If it's passed as an argument to `startGraphRenderLoop` and never updated, that's the bug.
