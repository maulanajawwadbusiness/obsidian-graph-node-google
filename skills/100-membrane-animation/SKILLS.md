---
name: membrane-animation
description: Apply Arnvoid’s “membrane” emergence animation to a window/popup so it feels like information sprouts from the void (anchor point), not a flat staccato box; includes reusable contract, pitfalls, and tuning knobs.
---

## intent (what this skill is)
this skill standardizes arnvoid’s **membrane animation** so a coding agent can apply it **reliably** to popups/windows across the repo.

**membrane animation** = a window **emerges** from an **anchor point** (node/cursor/button) with:
- elastic “sprout” (slight overshoot + settle)
- blur → focus (lens-like)
- staged content reveal (container first, then content)
- composite-only transitions (60fps-friendly)

## when to use
use this skill when you need any UI surface to *feel like it appears*:
- node popup variants
- context inspectors
- tool palettes
- quick panels that should feel “born” from a point in space
- “summon window from void” moments

**do not use** when:
- the window is a permanently docked panel with no anchor point (use a different pattern or a membrane adapter; see “context constraints” below)
- you are asked explicitly: “no transition” / “no animation”

## core principle (arnvoid philosophy)
the screen is a **membrane**. information should **emerge as body** from the void.
the user must feel: “this window is sprouting into reality,” not “a rectangle teleported.”

## hard invariants (must not break)
1. **composite-only**: animate only `transform`, `opacity`, and `filter` (blur). avoid layout-triggering props.
2. **anchor-driven**: emergence pivot is computed from an **anchor** `{x,y}` in the same coordinate space as the animated container.
3. **staged reveal**: container reveal first, then content reveal after a delay.
4. **initial paint guarantee**: the “hidden” style must be painted before switching to “visible”.
5. **no clipping**: avoid `overflow: hidden` ancestors that clip blur/shadow during overshoot.
6. **z-index sanity**: membrane window must appear above its context, and in a predictable stacking layer.

## terminology
- **anchor**: `{ x: number, y: number }` viewport coordinates for the “sprout origin”.
- **left/top**: computed window placement in viewport coordinates.
- **originX/originY**: transform-origin in *local window space*:
  - `originX = anchor.x - left`
  - `originY = anchor.y - top`
- **container reveal**: scale/opacity/blur transition.
- **content reveal**: content fades/slides in after container mostly exists.

## required inputs (minimum contract)
to apply membrane to any window:
- `anchor: { x, y }` (radius optional; can be 0)
- `triggerKey` (changes whenever you want the membrane “birth” to reset, e.g., nodeId / window instance id)
- computed window placement: `left`, `top` (viewport space)
- computed `transformOrigin: "${originX}px ${originY}px"`

## reference implementation (where it already exists)
the canonical membrane implementation is in:
- `src/popup/NodePopup.tsx` (styles + staged reveal + origin pivot)
- `src/popup/PopupStore.tsx` (open state + anchor geometry)
- `src/popup/PopupPortal.tsx`, `src/popup/PopupOverlayContainer.tsx` (fixed/portal context, z-index)

## behavioral spec (the “membrane feel” checklist)
### container (window shell)
- starts: `opacity: 0`, `transform: scale(0.8)`, `filter: blur(8px)`
- ends: `opacity: 1`, `transform: scale(1)`, `filter: blur(0)`
- easing: **back-out** for scale (elastic overshoot)
- duration: ~400ms for transform/opacity, ~350ms blur

### content (inside the window)
- delayed reveal: ~200ms after container start
- starts: slightly lower + transparent
- ends: settled + opaque

### choreography (timing)
- t=0: mount hidden state
- ~10ms: set visible state (ensures hidden state painted)
- ~200ms: contentVisible = true
- ~400–450ms: settle; measure final rect if needed by other UI (e.g., chatbar positioning)

## context constraints (IMPORTANT)
membrane math assumes **anchor coords and window coords share the same coordinate system**.

### safe context (recommended)
- a `position: fixed` or `position: absolute` overlay covering the viewport (portal-style)
- reason: left/top computed in viewport space, anchor is viewport space

### unsafe context (the “flex pitfall”)
- applying membrane directly inside a nested flex/normal flow container **without adapting coordinates**
- symptom: emergence comes from an offset/wrong location (“sliding box” feel)
- fix strategy (design-level, not implementation here):
  - either run the membrane in a portal overlay
  - or convert anchor into the parent’s local coordinate space before computing origin

## bolt-on checklist (apply membrane to a new window)
1. decide anchor source:
   - node center (best)
   - cursor position
   - button center
   - screen edge point (for “summon from boundary”)
2. ensure coordinate space:
   - if anchor is viewport coords, compute left/top in viewport coords too
3. compute origin:
   - originX = anchor.x - left
   - originY = anchor.y - top
4. mount hidden style FIRST (opacity 0, scale 0.8, blur 8px)
5. trigger visible state after paint:
   - delay ~10ms or use rAF(2) approach
6. stage content reveal:
   - delay ~200ms (tune as needed)
7. ensure no parent clipping:
   - verify blur/shadow aren’t cut
8. verify 60fps:
   - only composite props
   - add `will-change: transform, opacity, filter` if needed
9. verify interaction safety:
   - pointer events correct for visible/hidden states
10. verify pivot correctness:
   - click anchors at different screen positions; emergence direction must change correctly

## common failure modes (fast diagnosis)
- **sliding box**: transform-origin defaulted to center → origin math wrong or missing
- **staccato flash**: visible state set too early (no initial paint) → remove immediate set; ensure delay/rAF
- **clipped blur/shadow**: ancestor overflow hidden → move to portal overlay or remove clipping
- **layer war**: wrong z-index/stacking context (transforms can create stacking contexts) → align with overlay layer policy
- **ghosting / fps dip**: backdrop-filter or heavy blur on hi-dpi → reduce blur radius/duration, prefer filter blur only on the window itself

## tuning knobs (how to deepen the “membrane”)
- **elasticity (overshoot)**: back-out cubic-bezier “strength” (higher = more boing)
- **blur delta**: start blur px (higher = more “lens focusing”)
- **reveal sequencing**: content delay (longer = heavier shell, lighter content)
- **shadow depth**: spread/blur/alpha (more = window “above the void”)
- **membrane thickness**: subtle border/glow/alpha changes on shell
- **duration**: keep under ~450ms for responsiveness; longer only if explicitly desired

## reduced motion policy
currently not implemented in the canonical popup.
if adding membrane to new surfaces, consider:
- honoring `prefers-reduced-motion` by disabling transitions or reducing deltas
(do not add unless asked, but keep in mind.)

## teardown policy
canonical behavior: **no exit animation**; unmount is instant.
if an exit membrane is desired later:
- you must add a closing state and delay unmount
(not part of this skill’s “default”.)

## definition of done (acceptance tests)
membrane is “nailed” when:
1. window sprouts from the chosen anchor point (pivot correct across screen positions)
2. container appears elastic + focuses from blur to sharp
3. content reveals after container is mostly present (no noisy simultaneous pop)
4. no layout jank; 60fps remains stable
5. no clipping of blur/shadow during overshoot
6. rapid re-trigger (click different anchors quickly) does not produce zombie timers or broken states

## quick reuse recipe (agent shorthand)
- pick anchor `{x,y}`
- compute left/top in same coords
- set transform-origin to (x-left, y-top)
- hidden on mount → visible after 10ms/rAF
- content visible after 200ms
- animate only transform/opacity/filter
