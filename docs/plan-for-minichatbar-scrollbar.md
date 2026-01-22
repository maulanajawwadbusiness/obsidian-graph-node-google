# Scrollbar Arrows & Edge Fades — Implementation Plan

**Goal:** Remove arrow buttons, add truthful edge fades, thumb speaks through behavior.

---

## Constraints (Membrane-Truth Principles)

| # | Constraint | Rationale |
|---|------------|-----------|
| 1 | **Arrow kill hardening** | Nuke all button properties including background/border, target `:single-button` variants |
| 2 | **Theme-derived fade color** | Use CSS var `--panel-bg-rgb` so fades feel like depth, not painted overlay |
| 3 | **Fade clipping** | Wrapper uses `border-radius: inherit; overflow: hidden` to prevent square bleed |
| 4 | **Avoid React re-render** | Use `classList.toggle` via refs, not state updates, for 60fps scroll |
| 5 | **Gutter coupling** | Use shared `--scrollbar-gutter` var for fade insets, not hardcoded `12px` |

---

## Implementation Plan

### Run 1: Kill Arrows (Hardened)

**Goal:** Remove up/down arrow buttons with bulletproof CSS.

**File to edit:** `src/index.css`

**Changes:**

Add these rules after existing `.arnvoid-scroll` styling:

```css
/* Kill arrow buttons at scrollbar ends — hardened for Chromium */
.arnvoid-scroll::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
  background: transparent;
  border: 0;
}

.arnvoid-scroll::-webkit-scrollbar-button:single-button {
  display: none;
  width: 0;
  height: 0;
  background: transparent;
  border: 0;
}

.arnvoid-scroll::-webkit-scrollbar-button:start:decrement,
.arnvoid-scroll::-webkit-scrollbar-button:end:increment {
  display: none;
}
```

**Why all these rules:**
- `::-webkit-scrollbar-button` — catches generic button
- `:single-button` — catches single-button mode (some Windows themes)
- `:start:decrement` / `:end:increment` — catches specific up/down variants
- `background: transparent; border: 0` — prevents any visible remnant

**Acceptance tests:**
- [ ] Chrome Windows: No arrows at top/bottom
- [ ] Edge Windows: No arrows
- [ ] Chrome macOS: Still works (no change expected)
- [ ] Firefox: Uses thin scrollbar fallback (no arrows by design)

---

### Run 2: Edge Fades with Theme Colors & Clipping

**Goal:** Add top/bottom gradient fades that appear truthfully, use theme color, clip correctly.

**Files to edit:**
1. `src/index.css` — Add CSS vars and fade overlay styles
2. `src/popup/MiniChatbar.tsx` — Add wrapper, scroll listener with classList.toggle

---

**Step A: Define CSS vars (index.css)**

Add at `:root` or add to `.arnvoid-scroll-fades`:

```css
:root {
  /* Panel background as RGB for gradient use (matches rgba(20, 20, 30, 0.95)) */
  --panel-bg-rgb: 20, 20, 30;
  --panel-bg-opacity: 0.95;
  
  /* Scrollbar gutter width (shared with message scroller paddingRight) */
  --scrollbar-gutter: 12px;
}
```

---

**Step B: Fade overlay CSS (index.css)**

```css
/* Edge fades for scroll containers — membrane depth cues */
.arnvoid-scroll-fades {
  position: relative;
  border-radius: inherit;  /* Inherit parent rounding for proper clipping */
  overflow: hidden;        /* Clip gradients to rounded corners */
}

.arnvoid-scroll-fades::before,
.arnvoid-scroll-fades::after {
  content: '';
  position: absolute;
  left: 0;
  right: var(--scrollbar-gutter, 12px);  /* Don't cover scrollbar lane */
  height: 24px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 200ms ease-out;
  z-index: 1;
}

.arnvoid-scroll-fades::before {
  top: 0;
  background: linear-gradient(
    to bottom,
    rgba(var(--panel-bg-rgb), var(--panel-bg-opacity)) 0%,
    transparent 100%
  );
}

.arnvoid-scroll-fades::after {
  bottom: 0;
  background: linear-gradient(
    to top,
    rgba(var(--panel-bg-rgb), var(--panel-bg-opacity)) 0%,
    transparent 100%
  );
}

.arnvoid-scroll-fades.fade-top::before {
  opacity: 1;
}

.arnvoid-scroll-fades.fade-bottom::after {
  opacity: 1;
}
```

**Key points:**
- `right: var(--scrollbar-gutter)` — stays coupled to padding, no desync
- `rgba(var(--panel-bg-rgb), ...)` — theme-derived, feels like same membrane
- `border-radius: inherit; overflow: hidden` — clips to rounded corners
- `pointer-events: none` — content remains clickable

---

**Step C: Update MiniChatbar.tsx**

**New structure:**

```tsx
// Replace current messages div with wrapper pattern:

<div 
  ref={fadeWrapperRef}
  className="arnvoid-scroll-fades"
  style={{
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',  // Match chatbar inner rounding
  }}
>
  <div 
    ref={messagesRef}
    className="arnvoid-scroll"
    style={MESSAGES_STYLE}
  >
    {messages.map(...)}
    <div ref={messagesEndRef} />
  </div>
</div>
```

**New refs:**
```tsx
const messagesRef = useRef<HTMLDivElement>(null);
const fadeWrapperRef = useRef<HTMLDivElement>(null);
```

---

**Step D: Scroll listener with classList.toggle (no React state)**

```tsx
// RAF-throttled scroll listener using classList — avoids React re-render
useEffect(() => {
  const scroller = messagesRef.current;
  const wrapper = fadeWrapperRef.current;
  if (!scroller || !wrapper) return;

  let rafId = 0;
  
  const updateFades = () => {
    const { scrollTop, scrollHeight, clientHeight } = scroller;
    
    const hasTop = scrollTop > 8;
    const hasBottom = scrollTop + clientHeight < scrollHeight - 8;
    
    // Toggle classes directly on DOM — no React state update
    wrapper.classList.toggle('fade-top', hasTop);
    wrapper.classList.toggle('fade-bottom', hasBottom);
  };

  const onScroll = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateFades);
  };

  scroller.addEventListener('scroll', onScroll, { passive: true });
  
  // Initial evaluation
  updateFades();

  return () => {
    scroller.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(rafId);
  };
}, []);
```

**Also run after messages change:**
```tsx
// Re-evaluate fades when messages array changes
useEffect(() => {
  const scroller = messagesRef.current;
  const wrapper = fadeWrapperRef.current;
  if (!scroller || !wrapper) return;

  requestAnimationFrame(() => {
    const { scrollTop, scrollHeight, clientHeight } = scroller;
    
    wrapper.classList.toggle('fade-top', scrollTop > 8);
    wrapper.classList.toggle('fade-bottom', scrollTop + clientHeight < scrollHeight - 8);
  });
}, [messages]);
```

---

**Step E: Update MESSAGES_STYLE to use CSS var**

```tsx
const MESSAGES_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    paddingLeft: '4px',
    paddingRight: 'var(--scrollbar-gutter, 12px)',  // Use CSS var
};
```

---

**Pitfalls:**
- `rgba(var(--panel-bg-rgb), ...)` requires RGB values without alpha in the var
- `border-radius: inherit` needs explicit parent rounding or `8px` fallback
- Initial fade state must run after first paint (RAF in mount effect)

**Acceptance tests:**
- [ ] Short message list → no fades visible
- [ ] Scrolled to top → bottom fade visible only
- [ ] Scrolled to middle → both fades visible
- [ ] Scrolled to bottom → top fade visible only
- [ ] Click through fade area → pointer-events work
- [ ] Fades clip correctly at rounded corners (no square bleed)
- [ ] Fades use panel background color (not hardcoded gray)
- [ ] Scroll rapidly → 60fps, no jank, no React re-renders logged

---

### Run 3: Thumb Behavior Polish (Optional)

**Goal:** Thumb brightens while scrolling, fades back after decay.

**Files to edit:**
1. `src/index.css` — Add `.is-scrolling` thumb style
2. `src/popup/MiniChatbar.tsx` — Add scroll timeout logic

---

**CSS addition (index.css):**

```css
/* Thumb brightens while actively scrolling */
.arnvoid-scroll.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(99, 171, 255, 0.35);
}
```

---

**JS logic (MiniChatbar.tsx):**

Add inside the existing scroll listener:

```tsx
const scrollTimeoutRef = useRef<number>(0);

const onScroll = () => {
  // Existing RAF logic...
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(updateFades);
  
  // Thumb brightening with decay
  const scroller = messagesRef.current;
  if (scroller) {
    scroller.classList.add('is-scrolling');
    
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      scroller.classList.remove('is-scrolling');
    }, 400);
  }
};
```

**Cleanup in useEffect return:**
```tsx
return () => {
  scroller.removeEventListener('scroll', onScroll);
  cancelAnimationFrame(rafId);
  clearTimeout(scrollTimeoutRef.current);
};
```

---

**Acceptance tests:**
- [ ] Scroll actively → thumb slightly brighter (0.35 opacity)
- [ ] Stop scrolling → thumb fades back after ~400ms
- [ ] Hover still works independently
- [ ] No flicker during continuous scroll

---

## Summary Table

| Run | Target | Key Technique |
|-----|--------|---------------|
| 1 | Kill arrows | `::-webkit-scrollbar-button` + `:single-button` variants, all properties nuked |
| 2 | Edge fades | `::before/::after` overlays, `classList.toggle`, theme vars, gutter var |
| 3 | Thumb polish | `.is-scrolling` class with 400ms decay timeout |

---

## CSS Vars Summary

```css
:root {
  --panel-bg-rgb: 20, 20, 30;
  --panel-bg-opacity: 0.95;
  --scrollbar-gutter: 12px;
}
```

---

## Acceptance Criteria (Final)

- [ ] Arrow buttons gone permanently (bulletproof)
- [ ] Thumb is the only scroll object
- [ ] Top fade appears only when `scrollTop > 0`
- [ ] Bottom fade appears only when not at bottom
- [ ] Fades use theme color (no hardcoded fog)
- [ ] Fades clip to rounded corners (no square bleed)
- [ ] Fades don't block pointer events
- [ ] Scroll updates use classList.toggle (no React re-render)
- [ ] Gutter uses shared CSS var (no hardcoded desync)
- [ ] Thumb brightens while scrolling, decays after 400ms
- [ ] 60fps clean, no jank

