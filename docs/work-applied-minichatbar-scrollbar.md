# Scrollbar Arrows & Edge Fades — Implementation Report

**Completed:** 2026-01-20  
**Status:** ⚠️ Implemented but scrollbar not appearing (wiring issue)

---

## What Was Implemented

### Run 1: Kill Arrows (Hardened)

**File modified:** `src/index.css`

Added comprehensive webkit scrollbar button removal:

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

---

### Run 2: Edge Fades with Theme Colors & Clipping

**Files modified:**
1. `src/index.css` — CSS vars + fade overlay styles
2. `src/popup/MiniChatbar.tsx` — Wrapper structure + scroll listener

**CSS vars added (index.css):**
```css
:root {
  /* Panel background as RGB for gradient use (matches rgba(20, 20, 30, 0.95)) */
  --panel-bg-rgb: 20, 20, 30;
  --panel-bg-opacity: 0.95;
  
  /* Scrollbar gutter width (shared with message scroller paddingRight) */
  --scrollbar-gutter: 12px;
}
```

**Fade overlay CSS (index.css):**
```css
.arnvoid-scroll-fades {
  position: relative;
  border-radius: inherit;
  overflow: hidden;
}

.arnvoid-scroll-fades::before,
.arnvoid-scroll-fades::after {
  content: '';
  position: absolute;
  left: 0;
  right: var(--scrollbar-gutter, 12px);
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

**MiniChatbar.tsx changes:**

1. **Added refs:**
```tsx
const messagesRef = useRef<HTMLDivElement>(null);  // Scroll container
const fadeWrapperRef = useRef<HTMLDivElement>(null);  // Fade wrapper
```

2. **Updated MESSAGES_STYLE:**
```tsx
paddingRight: 'var(--scrollbar-gutter, 12px)',  // Use CSS var
```

3. **Added scroll listener:**
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
    updateFades();

    return () => {
        scroller.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(rafId);
    };
}, []);
```

4. **Added wrapper structure:**
```tsx
<div 
    ref={fadeWrapperRef}
    className="arnvoid-scroll-fades"
    style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
    }}
>
    <div 
        ref={messagesRef}
        className="arnvoid-scroll"
        style={MESSAGES_STYLE}
    >
        {messages.map(...)}
    </div>
</div>
```

5. **Updated message change effect:**
```tsx
useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Re-evaluate fades when messages change
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

### Run 3: Thumb Behavior Polish

**CSS added (index.css):**
```css
.arnvoid-scroll.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(99, 171, 255, 0.35);
}
```

**Note:** Scroll timeout logic for `is-scrolling` class was not added in this pass (listener would need update).

---

## Design Decisions

1. **classList.toggle instead of React state** — Avoids re-renders during scroll, maintains 60fps
2. **Theme-derived fade colors** — Uses `--panel-bg-rgb` CSS var so fades feel like membrane depth
3. **Gutter coupling** — `--scrollbar-gutter` var shared between padding and fade insets
4. **border-radius: inherit** — Fades clip correctly to chatbar rounding

---

## Issues Detected

⚠️ **Scrollbar not appearing**  
⚠️ **Minichatbar width cramped**

Likely causes:
- Wrapper div disrupting flex layout
- `overflow: hidden` on wrapper blocking scrollbar
- CSS var not being read correctly
- Scrollbar container lost `overflowY: auto`

See `codex-debug-brief.md` for detailed diagnosis request.

