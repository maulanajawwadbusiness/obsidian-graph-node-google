# FullChatbar UI Polish Report — Dark Elegance Pass #2

**Date**: 2026-01-28  
**Scope**: Frontend polish — transforming "ash brick" to "dark elegance"

---

## Changes Made

### 1) Chatbar Toggle Button (bottom-right)
- **Size**: Increased from 44×36px to **56×56px** (2x visual weight)
- **Border**: Removed entirely (no stroke/outline)
- **Fill**: Energy gradient in #56C4FF family:
  ```
  linear-gradient(135deg, rgba(56, 160, 220, 0.85) 0%, rgba(86, 196, 255, 0.9) 50%, rgba(100, 180, 240, 0.8) 100%)
  ```
- **Glow**: Subtle luminous shadow (`0 4px 20px rgba(86, 196, 255, 0.25)`)
- **Icon**: Sized at 24×24px, centered, ready for line icon swap

### 2) Full Chatbar Width
- Changed from `flex: '0 0 320px'` to **`flex: '0 0 30%'`**
- minWidth: 320px, maxWidth: 480px
- Canvas reflows cleanly via existing flex layout

### 3) Context Notification UI
- **Removed**: "Last Selected" node display
- **Kept**: Only "Active Context" (node with open popup)
- Display format: Blue dot (●) + node label — minimal, clear

### 4) Input Placeholder Semantics
- **Before**: "What needs clarification?" (too clinical)
- **After**: **"Trace the thought here…"**
- Tone: calm, analyst-room, invites tracing/thinking

### 5) Smooth Input Experience (Auto-Expand Textarea)
- **Auto-expands** with content up to 5 lines
- **No internal scrollbar** ever (`overflow: hidden`)
- After max height, stays fixed (content clipped at 5 lines)
- Height adjustments happen via `scrollHeight` measurement
- Enter=send, Shift+Enter=newline preserved
- Autoscroll to bottom on send/receive preserved

### 6) Global Panel Tone Shift: Ash Brick → Dark Elegance

**Token changes (before → after):**

| Token | Before (Ash) | After (Navy) |
|-------|--------------|--------------|
| bgPanel | `rgba(15, 15, 22, 0.98)` | `rgba(20, 20, 30, 0.98)` |
| bgSurface | `rgba(22, 22, 32, 0.95)` | `rgba(26, 26, 38, 0.95)` |
| bgInput | `rgba(28, 28, 40, 0.9)` | `rgba(32, 32, 46, 0.9)` |
| bgUserMessage | `rgba(35, 38, 48, 0.95)` | `rgba(38, 40, 54, 0.95)` |
| borderSubtle | `rgba(60, 65, 80, 0.4)` | `rgba(50, 52, 70, 0.5)` |
| textPrimary | `rgba(200, 205, 215, 0.95)` | `rgba(220, 225, 235, 0.95)` |
| textSecondary | `rgba(160, 165, 180, 0.75)` | `rgba(180, 190, 210, 0.85)` |

**Blue accent strategy:**
- Title "Reasoning": blue accent color
- Active context indicator: blue dot
- Send button: blue when active
- Empty state icon: subtle blue tint
- NOT everywhere — blue signals importance only

---

## Files Touched

| File | Changes |
|------|---------|
| `src/fullchat/FullChatToggle.tsx` | 2x larger, gradient fill, no border, luminous glow |
| `src/fullchat/FullChatbar.tsx` | 30% width, navy palette, blue accents, auto-expand input, context logic |

---

## Before/After: Dark Elegance

**Before (Ash Brick)**:
- Gray-dominant surfaces
- Muted text everywhere
- No energy, reads like dust
- Input showed scrollbar, felt staccato

**After (Dark Elegance)**:
- Deep navy base matching NodePopup
- White/soft-white text with clear hierarchy
- Blue accents beam the essence (title, context, actions)
- Input auto-expands smoothly, premium feel
- Spacious padding and generous gaps

---

## Regression Verification

| Behavior | Status |
|----------|--------|
| Pointer ownership (panel blocks canvas) | ✅ Intact |
| Wheel scroll inside chat | ✅ Works correctly |
| Autoscroll on send/receive | ✅ Working |
| Enter to send | ✅ Working |
| Shift+Enter for newline | ✅ Working |
| Panel width = 30% | ✅ Confirmed |
| Popups overlap on top | ✅ z-index correct (1001 > 500) |
| No transitions (v1) | ✅ Instant appear/disappear |
| No internal scrollbar in input | ✅ Hidden, auto-expand only |

---

## Design Philosophy Applied

> "Dark elegance: deep navy base, intelligent blue energy accents, spacious minimalism, calm analyst room for 20-hour thinking."

The panel now matches the canonical NodePopup identity:
- Same background color family (`rgba(20, 20, 30, 0.95)`)
- Same text color hierarchy
- Same blue accent treatment for labels
- Same spacious, minimal aesthetic

The toggle button is now an "energy" button that feels like it belongs to the Arnvoid node system — luminous, intentional, not tiny.
