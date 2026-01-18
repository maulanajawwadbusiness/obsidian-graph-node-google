# Handoff Document: Dark Power Elegant v2 + Hover Energy System

**Last Updated:** 2026-01-18  
**Status:** Hover energy system implemented (has bug - visual interpolation not working)  
**Next Developer:** Claude Sonnet

---

## 1. Project Snapshot

### What This Is
Force-directed graph physics playground (similar to Obsidian graph view) with two visual themes:
- **Normal mode:** Blue filled nodes (baseline, unchanged)
- **Elegant v2 mode:** Dark power aesthetic with hollow gradient rings, two-layer glow, vignette background

### What Runs #1, #2, and #3 Changed
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
  - **Known bug:** Visual interpolation not working (blue disappears instead of smooth wake-up)

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
- **Ring width:** Scales with `nodeScale` master knob (currently `1.2`)

### Gradient Ring Implementation
- **Method:** Segmented arcs (48 segments) for cross-browser compatibility
- **Rotation:** `gradientRotationDegrees = 150` (dark purple at bottom-left)
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
- **Energy range:** 0 (asleep, dark blue #3d4857) → 1 (awake, bright blue #63abff)
- **Proximity model:** Smoothstep with halo detection
  - Inside node (d ≤ r): energy = 1
  - In halo zone (r < d ≤ halo): energy = smoothstep((halo-d)/(halo-r))
  - Outside halo: energy = 0
- **Halo radius:** `nodeRadius * 1.8` (detection extends beyond node)
- **Time smoothing:** Tau-based exponential lerp (120ms)
- **Hit-test:** Whole disc (halo-based, not ring-only)
- **Architecture:** Handlers returned from `useGraphRendering` hook, camera stays internal
- **Coordinate transform:** CSS pixels (getBoundingClientRect) → world space via camera inverse
- **Anti-flicker:** Sticky exit (1.05x), anti ping-pong (8px margin), pop prevention
- **Energy-driven rendering:**
  - Color: `lerpColor(primaryBlueDefault, primaryBlueHover, energy)`
  - Ring width: `baseWidth * (1 + 0.1 * energy)` (10% max boost)
- **Debug:** Console log on change + radius/halo circles + energy text overlay
- **⚠️ Known bug:** Visual interpolation not working - blue color disappears instead of smooth wake-up

---

## 3. Hard Invariants (DO NOT BREAK)

### Visual Parity
✅ **Normal mode must stay identical to baseline**  
- No changes to filled circle rendering, colors, or behavior
- Only elegant mode has new features

### Architecture Rules
✅ **Camera stays internal to `useGraphRendering`**  
- Do NOT expose `cameraRef` back to component
- Pointer handlers returned from hook: `{ handlePointerMove, handlePointerLeave }`

✅ **Hover hit-test must be whole node disc (halo-based)**  
- NOT ring-only, NOT pixel sampling, NOT arc-segment dependent
- Formula: `haloRadius = renderedRadius * hoverHaloMultiplier` (1.8x)
- Distance check: `dist <= haloRadius` where `dist = sqrt((node.x - worldX)^2 + (node.y - worldY)^2)`
- Proximity model: smoothstep for energy calculation within halo zone

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
const ELEGANT_NODE_SCALE = 1.2;  // Scales both radius and ringWidth proportionally
```

#### Gradient Ring Colors
```typescript
primaryBlueDefault: '#3d4857',     // Dark blue (no hover)
primaryBlueHover: '#63abff',       // Bright blue (hovered)
deepPurple: '#4a2a6a',             // Rich dark purple
gradientRotationDegrees: 150,      // Rotation angle (150° = purple bottom-left)
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
hoverHaloMultiplier: 1.8,       // Detection radius = nodeRadius * 1.8
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
hoverDebugEnabled: true,        // Show radius/halo circles + energy text
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
**Purpose:** Rendering loop, camera, physics, hover state, pointer handlers

**Key Responsibilities:**
- Main render loop (RAF-based)
- Camera state (pan/zoom, auto-framing)
- Hover state management (`hoverStateRef`)
- Pointer handlers: `handlePointerMove()`, `handlePointerLeave()`
- Drawing functions:
  - `drawGradientRing()` — segmented arc gradient
  - `drawVignetteBackground()` — radial vignette
  - `drawTwoLayerGlow()` — layered blur
- Coordinate transform: `cssToWorld()`
- Hit-test: `findNearestNode()` — disc-based detection

**Returns:** `{ handlePointerMove, handlePointerLeave }`

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
- [ ] **⚠️ Known bug:** Blue may disappear instead of smooth wake-up

### Debug Features
- [ ] Open console
- [ ] Hover nodes → see log: `hover: null -> n0 (dist=X.X, r=Y.Y, halo=Z.Z, energy=0.XX)`
- [ ] Verify **cyan solid circle** at node radius
- [ ] Verify **yellow dashed circle** at halo radius
- [ ] Verify **energy text** overlay shows `e=0.xx t=0.xx d=XXX`
- [ ] Verify no log spam (only on node change)

### Edge Cases
- [ ] Spawn 5 nodes → verify hover works on all sizes
- [ ] Toggle size variation → verify hit-test stays accurate
- [ ] Drag node while hovering → verify no crashes

---

## 7. Known Issues / Next Tasks

### Current Bug
🐛 **Hover energy visual interpolation not working**  
- **Symptom:** Blue color disappears completely instead of smooth energy wake-up
- **What works:** Proximity detection (debug circles show), energy calculation (console logs show values)
- **What's broken:** Visual color interpolation - `lerpColor()` may have issue or energy not being applied correctly
- **Debug enabled:** Set `hoverDebugEnabled: true` to see radius/halo circles and energy values
- **Status:** Under investigation

### Completed Features (Run #3)
- ✅ Proximity model with smoothstep
- ✅ Tau-based time smoothing (120ms)
- ✅ Hysteresis (sticky exit 1.05x)
- ✅ Anti ping-pong switching (8px margin)
- ✅ Pop prevention on node switch
- ✅ Debug overlays (radius/halo circles, energy text)
- ✅ Energy-driven ring width boost (10% max)

### Future Enhancements (Not Yet Implemented)
- **Glow boost:** Use `hoverGlowBoost` knob (currently reserved)
- **Cursor-field effects:** Multiple nodes respond to cursor proximity
- **Smart nearest-node:** Prefer closest with better heuristics
- **Hover radius tuning UI:** Real-time slider for halo multiplier

---

## 8. Debugging Commands

### Enable Debug Mode
```typescript
// In src/visual/theme.ts, ELEGANT_THEME:
hoverDebugEnabled: true,
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
// findNearestNode() in useGraphRendering.ts
const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
const renderedRadius = getNodeRadius(baseRadius, theme);
const hitRadius = renderedRadius + 2;  // +2px padding

if (dist <= hitRadius && dist < nearestDist) {
  nearestId = node.id;
}
```

### Coordinate Transform (CSS → World)
```typescript
// cssToWorld() in useGraphRendering.ts
const cssX = clientX - rect.left - rect.width / 2;
const cssY = clientY - rect.top - rect.height / 2;
const worldX = cssX / camera.zoom - camera.panX;
const worldY = cssY / camera.zoom - camera.panY;
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
