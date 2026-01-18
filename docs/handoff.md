# Handoff Document: Dark Power Elegant v2 + Hover Energy System

**Last Updated:** 2026-01-18  
**Status:** Hover energy system stabilized (color, selection, timing, pointer lifecycle, radius alignment, debug isolation)  
**Next Developer:** Claude Sonnet

---

## 1. Project Snapshot

### What This Is
Force-directed graph physics playground (similar to Obsidian graph view) with two visual themes:
- **Normal mode:** Blue filled nodes (baseline, unchanged)
- **Elegant v2 mode:** Dark power aesthetic with hollow gradient rings, two-layer glow, vignette background

### What Runs #1-#8 Changed
- **Run #1:** Implemented elegant skin foundation (hollow rings, occlusion disks, dark background)
- **Run #2:** Upgraded to "Dark Power Elegant v2" with:
  - Blue→purple gradient rings (segmented arcs, 48 segments)
  - Rotated gradient orientation (150°, dark purple bottom-left for visual gravity)
  - Two-layer glow system (inner blue, outer purple)
  - Radial vignette background (center lighter, edges near-black)
  - Binary hover color switch (#3d4857 default → #63abff bright on hover)
  - Debug infrastructure (console logs, visual overlay)
- **Run #3:** Implemented proximity-based hover energy system:
  - Smooth energy interpolation [0..1] with halo detection
  - Tau-based time smoothing (120ms, Apple-like feel)
  - Hysteresis + anti ping-pong switching
  - Energy-driven color lerp and ring width boost
  - Debug overlays (radius/halo circles, energy text)
  - **Bug fixed:** Blue interpolation now stable (rgb/hex parsing)
- **Run #4:** Coordinate space correctness (CSS pixels + camera + rotation), DPR-safe rendering, and cursor crosshair debug
- **Run #5:** Selection stability (active candidate, sticky exit, margin switching) + debug decision telemetry
- **Run #6:** Time smoothing hardening (dt clamp, tau guard, energy clamp, dt debug)
- **Run #7:** Render-state hygiene (save/restore boundaries, explicit canvas state resets, debug isolation)
- **Run #8:** Performance + lifecycle fixes
  - Selection throttled to pointer changes + camera drift
  - Active pointer tracking (multi-pointer safe)
  - Hit/halo radius alignment to ring outer edge + small padding
  - Debug gating (`hoverDebugStateSentinel`)
- **Run #9:** Rendering hook modularization (refactor only, no behavior changes)
  - Split `useGraphRendering.ts` from 1300+ lines → ~256 line orchestrator
  - Created `src/playground/rendering/` folder with 8 specialized modules
  - Separation of concerns: types, math, canvas utils, hover controller, energy, camera, drawing, metrics
  - Improved testability and maintainability
- **Run #10:** Energy-driven glow (alpha scaling with hoverEnergy)
  - Added 4 theme knobs: `glowInnerAlphaBase/Boost`, `glowOuterAlphaBase/Boost`
  - Glow formula: `alpha = base + energy * boost`
  - ELEGANT_THEME: inner 0.04→0.22, outer 0.02→0.12 at full energy
  - Modified `drawTwoLayerGlow()` to accept energy parameter
  - Updated node drawing to pass `nodeEnergy` to glow before ring draw
  - Debug overlay shows computed glow alpha values
  - **Current bug:** Glow disappears entirely (investigating alpha computation)

---

## 2. Current Implemented Features

### Skin Toggle
- Toggle button on canvas (top-left, after debug toggle)
- Default: `elegant` mode
- Controlled by `skinMode` state in `GraphPhysicsPlayground.tsx`
- Visibility flag: `SHOW_THEME_TOGGLE` in `graphPlaygroundStyles.ts`

### Hollow Ring Nodes (Elegant Mode)
- **Occlusion disk:** Hides links underneath node, matches background color
- **Ring stroke:** Gradient from blue→purple or solid fallback
- **Ring width:** Scales with `nodeScale` master knob (currently `4`)

### Gradient Ring Implementation
- **Method:** Segmented arcs (48 segments) for cross-browser compatibility
- **Rotation:** `gradientRotationDegrees = 170` (dark purple at bottom-left)
- **Colors:** `primaryBlue` (#63abff or #3d4857 based on hover) → `deepPurple` (#4a2a6a)
- **Function:** `drawGradientRing()` in `useGraphRendering.ts`

### Two-Layer Glow
- **Outer glow:** Purple, wider, fainter (20px radius, 0.12 alpha)
- **Inner glow:** Blue, tighter, brighter (8px radius, 0.22 alpha)
- **Draw order:** Outer first, then inner (creates depth)

### Vignette Background
- **Radial gradient:** Center (#0f0f1a) → Edge (#050508)
- **Strength:** 0.7
- **Function:** `drawVignetteBackground()` in `useGraphRendering.ts`

### Hover Energy System (Proximity-Based)
- **Energy range:** 0 (asleep, dark blue #3d4857) -> 1 (awake, bright blue #63abff)
- **Proximity model:** Smoothstep with halo detection
  - Inside hit radius (d <= hit): energy = 1
  - In halo zone (hit < d <= halo): energy = smoothstep((halo - d) / (halo - hit))
  - Outside halo: energy = 0
- **Rendered radius:** ring outer edge (renderRadius + ringWidth / 2)
- **Hit radius:** `outerRadius + 2px` (small padding)
- **Halo radius:** `outerRadius * 1.8` (detection extends beyond node)
- **Time smoothing:** Tau-based exponential lerp (120ms)
- **Hit-test:** Whole disc (includes hollow interior, not ring-only)
- **Architecture:** Handlers returned from `useGraphRendering` hook, camera stays internal
- **Coordinate transform:** CSS pixels (getBoundingClientRect) -> camera inverse -> world space, includes global rotation
- **Anti-flicker:** Sticky exit (1.05x), anti ping-pong (8px margin), pop prevention
- **Selection:** Active candidate model, pointer-throttled, O(1) when pointer idle
- **Energy-driven rendering:**
  - Color: `lerpColor(primaryBlueDefault, primaryBlueHover, energy)`
  - Ring width: `baseWidth * (1 + 0.1 * energy)` (10% max boost)
- **Timing hardening:** dt clamp (max 40ms), tau guard, energy clamp + NaN recovery
- **Debug:** Console log on change + render/hit/halo circles + energy text + crosshair + perf counters

---

## 3. Hard Invariants (DO NOT BREAK)

### Visual Parity
✅ **Normal mode must stay identical to baseline**  
- No changes to filled circle rendering, colors, or behavior
- Only elegant mode has new features

### Architecture Rules
✅ **Camera stays internal to `useGraphRendering`**  
- Do NOT expose `cameraRef` back to component
- Pointer handlers returned from hook: `{ handlePointerMove, handlePointerEnter, handlePointerLeave, handlePointerCancel, handlePointerUp }`

- **Hover hit-test must be whole node disc (hit/halo based)**
- NOT ring-only, NOT pixel sampling, NOT arc-segment dependent
- Formula: `outerRadius = renderRadius + ringWidth/2`, `hitRadius = outerRadius + 2px`
- Halo: `haloRadius = outerRadius * hoverHaloMultiplier` (1.8x)
- Distance: `dist <= hitRadius` for full energy, smoothstep in halo zone

✅ **Pointer coordinates must use CSS pixel space**  
- Use `getBoundingClientRect()` for canvas dimensions (NOT canvas.width/height directly)
- Avoids devicePixelRatio issues
- Transform: CSS pixels → camera inverse → world coordinates

✅ **Debuggability mandatory**  
- All new systems must have debug toggle + change-only console logs
- No log spam (only log state transitions)

### Code Quality
✅ **Minimal diff policy**  
- Only change what's necessary for the feature
- No surprise refactors unless explicitly requested

---

## 4. Knobs + Where They Live

### `src/visual/theme.ts`

#### Master Scale Control
```typescript
const ELEGANT_NODE_SCALE = 4;  // Scales both radius and ringWidth proportionally
```

#### Gradient Ring Colors
```typescript
primaryBlueDefault: '#3d4857',     // Dark blue (no hover)
primaryBlueHover: '#63abff',       // Bright blue (hovered)
deepPurple: '#4a2a6a',             // Rich dark purple
gradientRotationDegrees: 170,      // Rotation angle (150° = purple bottom-left)
ringGradientSegments: 48,          // Smoothness (32-64 recommended)
```

#### Glow Parameters
```typescript
glowInnerColor: 'rgba(99, 171, 255, 0.22)',   // Blue, closer
glowInnerRadius: 8,
glowInnerAlpha: 0.22,
glowOuterColor: 'rgba(100, 60, 160, 0.12)',   // Purple, wider
glowOuterRadius: 20,
glowOuterAlpha: 0.12,
```

#### Vignette Background
```typescript
vignetteCenterColor: '#0f0f1a',    // Lighter indigo
vignetteEdgeColor: '#050508',      // Near-black
vignetteStrength: 0.7,             // 0.0-1.0 (how far gradient extends)
```

#### Hover Energy System
```typescript
// Basic colors
primaryBlueDefault: '#3d4857',  // Dark blue (asleep)
primaryBlueHover: '#63abff',    // Bright blue (awake)

// Proximity detection
hoverHaloMultiplier: 1.8,       // Detection radius = outerRadius * 1.8
hoverRadiusMultiplier: 2.2,     // DEPRECATED (kept for compatibility)

// Time smoothing
hoverEnergyTauMs: 120,          // Tau constant (Apple-like feel)

// Anti-flicker
hoverStickyExitMultiplier: 1.05,// Hysteresis for exit (5% buffer)
hoverSwitchMarginPx: 8,         // Anti ping-pong margin

// Energy-driven effects
hoverRingWidthBoost: 0.1,       // 10% max ring width boost
hoverGlowBoost: 0.15,           // Reserved for future

// Debug
hoverDebugEnabled: false,       // Show radius/hit/halo circles + energy text
hoverDebugStateSentinel: false, // Log canvas state sentinel once
```


#### Link Style
```typescript
linkColor: 'rgba(99, 140, 200, 0.38)',  // Indigo-tinted
linkWidth: 0.6,
```

---

## 5. Files Touched + Responsibilities

### Core Files

#### `src/visual/theme.ts`
**Purpose:** Centralized visual configuration (palette, knobs, theme objects)

**Key Exports:**
- `ThemeConfig` interface
- `NORMAL_THEME` (baseline)
- `ELEGANT_THEME` (dark power v2)
- `getTheme(skinMode)` getter
- Color utilities: `hexToRgb()`, `lerpColor()`

#### `src/playground/useGraphRendering.ts`
**Purpose:** Thin orchestrator (~256 lines) wiring rendering subsystems

**Key Responsibilities:**
- State refs initialization (settings, pointer, hover, camera)
- Hover controller setup via `createHoverController()`
- Main render loop (RAF-based): physics tick, energy update, canvas setup, camera containment, selection update, transforms, drawing, metrics
- Window blur cleanup

**Returns:** `{ handlePointerMove, handlePointerEnter, handlePointerLeave, handlePointerCancel, handlePointerUp, clientToWorld }`

#### `src/playground/rendering/` (Modularized Subsystems)

**New in Run #9:** Rendering logic split into 8 specialized modules:

- **renderingTypes.ts** - Shared types + state factories (`HoverState`, `CameraState`, etc.)
- **renderingMath.ts** - Math helpers (`clamp`, `smoothstep`, `rotateAround`)
- **canvasUtils.ts** - Canvas isolation + drawing primitives (`withCtx`, vignette, gradient ring, glow)
- **hoverController.ts** - Pointer lifecycle + hover selection + transforms
- **hoverEnergy.ts** - Energy smoothing (tau-based, dt clamp)
- **camera.ts** - Leash containment + camera transforms
- **graphDraw.ts** - Links, nodes, debug overlays, crosshair
- **metrics.ts** - FPS/velocity/shape tracking

**Behavior Note:** Pure refactor for code organization. **No behavior changes** to hover, camera, or rendering logic.

#### `src/playground/GraphPhysicsPlayground.tsx`
**Purpose:** Main component, wires pointer events, hosts controls

**Key Responsibilities:**
- Canvas container + event wiring
- Destructures handlers from `useGraphRendering`
- Wraps handlers for React events (`onPointerMove`, `onPointerLeave`)
- Skin toggle state (`skinMode`)
- Drag-and-drop (existing, mouse-based)

### Supporting Files

#### `src/playground/graphPlaygroundStyles.ts`
- `SHOW_THEME_TOGGLE` flag (controls toggle visibility)
- Container and canvas styles

#### `src/playground/components/CanvasOverlays.tsx`
- Debug panel + theme toggle button

---

## 6. How to Test (Manual Acceptance)

### Skin Toggle
- [ ] Click theme toggle button
- [ ] Verify smooth switch between normal (filled blue) and elegant (hollow gradient rings)
- [ ] Verify background changes to vignette in elegant mode

### Gradient Orientation
- [ ] In elegant mode, observe nodes
- [ ] Bright blue segment should appear at **top-right**
- [ ] Dark purple segment should appear at **bottom-left**
- [ ] Gradient should be smooth (no banding or gaps)

### Hover Energy System
- [ ] Move cursor **toward** a node (not touching yet)
- [ ] Node should start **brightening before reaching the ring** (halo detection)
- [ ] Inside node disc → reaches full bright blue **smoothly** (not instant)
- [ ] Move cursor away → node **fades back smoothly** (no snap)
- [ ] Move along boundary → **no flicker** (hysteresis working)
- [ ] Pointer leaves canvas → hover clears smoothly

### Debug Features
- [ ] Open console
- [ ] Hover nodes and see log: `hover: null -> n0 (dist=..., r=..., halo=..., energy=...)`
- [ ] Verify **cyan solid circle** at rendered radius
- [ ] Verify **magenta dashed circle** at hit radius
- [ ] Verify **yellow dashed circle** at halo radius
- [ ] Verify **crosshair** sits under cursor
- [ ] Verify **energy text** overlay shows `e=0.xx t=0.xx d=XXX`
- [ ] Verify **perf text** shows `scan`, `sel/s`, `en/s`
- [ ] Verify no log spam (only on state change)
- [ ] Verify dt clamp/spike logs appear only when triggered

### Edge Cases
- [ ] Spawn 5 nodes → verify hover works on all sizes
- [ ] Toggle size variation → verify hit-test stays accurate
- [ ] Drag node while hovering → verify no crashes

---

## 7. Known Issues / Next Tasks

### Current Bug
🐛 **Energy-driven glow disappears entirely (Run #10)**  
- **Symptom:** No glow visible on any nodes after implementing energy-driven alpha
- **What works:** Energy computation (debug shows correct values), alpha calculation (debug shows `in=0.XX out=0.XX`)
- **What's broken:** Glow rendering - computed alpha values not producing visible glow
- **Likely causes:** 
  - Alpha values too low (0.04/0.02 base may be invisible)
  - Blend mode issue with dynamic alpha
  - Filter/blur state leak
- **Debug:** Set `hoverDebugEnabled: true` to see computed alpha in overlay
- **Status:** Under investigation (don't fix yet)

### Completed Features (Runs #3-#10)
- Proximity model with smoothstep
- Tau-based time smoothing (120ms) + dt clamp
- Hysteresis (sticky exit 1.05x) + margin switching
- Pop prevention on node switch
- Pointer lifecycle handling (enter/leave/cancel/up + blur)
- Active pointer tracking (multi-pointer safe)
- Radius alignment (outer edge + hit padding)
- Debug overlays (render/hit/halo circles, energy text, crosshair)
- Render-state isolation (save/restore boundaries)
- Selection throttling + perf counters
- **Rendering modularization** (Run #9): 1300+ lines → 8 modules + ~256 line orchestrator
- **Energy-driven glow** (Run #10): Alpha scales with hoverEnergy (base + boost model) - currently broken

### Future Enhancements (Not Yet Implemented)
- **Cursor-field effects:** Multiple nodes respond to cursor proximity
- **Smart nearest-node:** Prefer closest with better heuristics
- **Hover radius tuning UI:** Real-time slider for halo multiplier
- **Glow blur radius scaling:** Optionally scale blur radius with energy (deferred from Run #10)

---

## 8. Debugging Commands

### Enable Debug Mode
```typescript
// In src/visual/theme.ts, ELEGANT_THEME:
hoverDebugEnabled: true,
hoverDebugStateSentinel: false,
```

### Verify Hover Hit-Test
```typescript
// Console should show:
hover: null -> n0 (dist=12.3, hitR=24.5)
hover: n0 -> n1 (dist=8.7, hitR=22.1)
hover: n1 -> null (pointer left canvas)
```

### Tune Master Scale
```typescript
// In src/visual/theme.ts:
const ELEGANT_NODE_SCALE = 1.5;  // Make nodes 50% larger
```

---

## 9. Critical Code Patterns

### Hover Hit-Test (Disc Logic)
```typescript
// getInteractionRadii() in useGraphRendering.ts
const renderRadius = getNodeRadius(baseRadius, theme);
const outerRadius = theme.nodeStyle === 'ring'
  ? renderRadius + theme.ringWidth * 0.5
  : renderRadius;
const hitRadius = outerRadius + 2;  // +2px padding
const haloRadius = outerRadius * theme.hoverHaloMultiplier;
```

### Coordinate Transform (CSS -> World)
```typescript
// clientToWorld() in useGraphRendering.ts
const cssX = clientX - rect.left - rect.width / 2;
const cssY = clientY - rect.top - rect.height / 2;
const unrotatedX = cssX / camera.zoom - camera.panX;
const unrotatedY = cssY / camera.zoom - camera.panY;
const world = rotateAround(unrotatedX, unrotatedY, centroid.x, centroid.y, -angle);
```

### Gradient Ring Drawing (Segmented Arcs)
```typescript
// drawGradientRing() in useGraphRendering.ts
const segmentAngle = (Math.PI * 2) / segments;
const rotationOffset = (rotationDegrees * Math.PI) / 180;

for (let i = 0; i < segments; i++) {
  const t = i / segments;
  const color = lerpColor(startColor, endColor, t);
  const startAngle = i * segmentAngle + rotationOffset - 0.02;
  const endAngle = (i + 1) * segmentAngle + rotationOffset + 0.02;
  ctx.arc(x, y, radius, startAngle, endAngle);
  // ...stroke
}
```

---

## 9. Validating Run #9 Modularization

**Quick Manual Check (No Behavior Changes Expected):**

Since Run #9 was a pure refactor, verify rendering parity:

1. **Run the app:**
   ```bash
   npm run dev
   ```

2. **Hover energy system:**
   - [ ] Move pointer toward nodes → smooth color wake-up (dark → bright blue)
   - [ ] Inside node → full bright blue
   - [ ] Move away → smooth fade back to dark
   - [ ] No flicker when moving between close nodes

3. **Debug overlays (if enabled):**
   - [ ] Set `hoverDebugEnabled: true` in theme.ts
   - [ ] Verify cyan (render), magenta (hit), yellow (halo) circles appear
   - [ ] Verify energy text overlay shows values
   - [ ] Verify crosshair follows cursor

4. **Camera framing:**
   - [ ] Spawn nodes → camera auto-frames graph
   - [ ] Graph stays centered and visible
   - [ ] Smooth camera transitions

5. **Rendering parity:**
   - [ ] Gradient rings render correctly (blue → purple)
   - [ ] Two-layer glow visible
   - [ ] Vignette background in elegant mode
   - [ ] No visual artifacts or canvas state leaks

6. **Console:**
   - [ ] No errors or warnings
   - [ ] Hover logs only on node change (if debug enabled)
   - [ ] No performance degradation

**Expected Result:** Everything should work exactly as before Run #9. If any behavior changed, the modularization introduced a bug.

---

## 10. Acceptance Criteria Summary

**Before merging any changes:**
- [ ] Normal mode unchanged (visual regression test)
- [ ] Hover works on entire node disc (blue, purple, center)
- [ ] Debug logs show correct hitRadius
- [ ] No console errors or React warnings
- [ ] Gradient orientation correct (purple bottom-left)
- [ ] All manual acceptance tests pass

**Code style:**
- [ ] TypeScript strict mode passes
- [ ] No unused variables or imports
- [ ] Console logs only on state change (no spam)
- [ ] Comments explain "why", not "what"

---

**End of handoff. Good luck, Sonnet! 🚀**
