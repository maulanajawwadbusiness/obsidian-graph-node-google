# Dark Elegance Design Grammar

A shared vocabulary for designing in the "void with energy escaping" aesthetic.

---

## Core Philosophy

**Dark Elegance** is not "dark mode". It's a visual philosophy:

> *The interface is a void. Light is precious. Color is energy that escapes from depth.*

The goal: **mesmerizing restraint**. Every bright element earns its place.

---

## The Vocabulary

### 1. THE VOID (Background Layer)

**What it is**: The deepest layer. Near-black. Where everything lives.

**Words to use**:
- "void" — the base darkness
- "abyss" — the deepest black (#08080c)
- "depth" — layers receding into darkness
- "surface" — slightly elevated from the void
- "elevated" — floating above the surface

**How it translates to CSS**:
| Word | Hex Range | Usage |
|------|-----------|-------|
| abyss/deepest | `#08080c` to `#0a0a10` | Panel backgrounds, main canvas |
| void/deep | `#0c0c12` to `#10101a` | Primary containers |
| surface | `#101016` to `#14141c` | Elevated cards, input areas |
| elevated | `#18182a` to `#1c1c2a` | Hovered states, active items |

**Example request**: *"Make this panel feel more like the void — it's too gray right now."*

---

### 2. ENERGY (Accent Color)

**What it is**: The blue that escapes from the darkness. Precious. Rare. Meaningful.

**Words to use**:
- "energy" — the core accent (#56C4FF)
- "glow" — energy with blur/shadow
- "leak" — energy escaping through edges/borders
- "beam" — concentrated energy on key elements
- "pulse" — (future) animated energy

**How it translates to CSS**:
| Word | CSS Property | Example |
|------|--------------|---------|
| energy | `color`, `fill` | `#56C4FF` or `rgba(86, 196, 255, 0.9)` |
| glow | `text-shadow`, `box-shadow` | `0 0 20px rgba(86, 196, 255, 0.3)` |
| leak | `border`, `box-shadow inset` | `border-left: 1px solid rgba(86, 196, 255, 0.15)` |
| beam | concentrated color on titles/labels | Title with `color: #56C4FF` + subtle glow |

**Restraint rule**: Energy should appear in **≤5 places** per panel:
1. Title/heading
2. Primary action (send button)
3. Active indicator (dot, border)
4. Focus state (input border)
5. Empty state subtle glow

**Example request**: *"The send button should beam when active — make the energy visible."*

---

### 3. TEXT HIERARCHY (Content Layer)

**Words to use**:
- "bright" — primary text, highest contrast
- "soft" — secondary text, readable but receding
- "dim" — tertiary text, almost fading into void
- "ghost" — placeholder text, barely visible

**How it translates to CSS**:
| Word | Opacity/Color | Usage |
|------|---------------|-------|
| bright | `rgba(255, 255, 255, 0.92)` | User content, important labels |
| soft | `rgba(200, 210, 225, 0.7)` | Body text, AI responses |
| dim | `rgba(140, 150, 170, 0.5)` | Secondary labels, timestamps |
| ghost | `rgba(100, 110, 130, 0.4)` | Placeholders, disabled states |

**Example request**: *"The AI response text feels too bright — make it soft."*

---

### 4. BORDERS & SEPARATION (Structure Layer)

**Words to use**:
- "line" — barely visible separator
- "edge" — structural boundary
- "energy line" — border with blue tint (leak)
- "invisible" — no visible border, separation via background

**How it translates to CSS**:
| Word | CSS | Example |
|------|-----|---------|
| line | `border: 1px solid` | `rgba(255, 255, 255, 0.04)` |
| edge | `border: 1px solid` | `rgba(255, 255, 255, 0.08)` |
| energy line | `border: 1px solid` | `rgba(86, 196, 255, 0.12)` |
| invisible | no border | Use background difference instead |

**Example request**: *"Add an energy line on the left edge — light escaping from the seam."*

---

### 5. DEPTH & DIMENSION (Spatial Layer)

**Words to use**:
- "recede" — push element into background
- "float" — element appears above surface
- "mesmerizing" — draws the eye, creates focus
- "breathe" — generous spacing, not cramped

**How it translates to CSS**:
| Word | CSS Property | Example |
|------|--------------|---------|
| recede | lower opacity, darker bg | Reduce opacity to 0.6 |
| float | `box-shadow`, lighter bg | `box-shadow: 0 4px 20px rgba(0,0,0,0.5)` |
| mesmerizing | glow + depth | Combine inner glow with gradient bg |
| breathe | `padding`, `gap` | `padding: 24px`, `gap: 20px` |

**Example request**: *"This input area needs to breathe more — it feels cramped."*

---

## Anti-Patterns (Words NOT to use)

| Don't Say | Why | Say Instead |
|-----------|-----|-------------|
| "gray" | Gray is stale, lifeless | "void", "deep navy" |
| "dark mode" | Too generic | "dark elegance", "void" |
| "blue everywhere" | Violates restraint | "energy where it matters" |
| "pop" | Too aggressive | "beam", "glow" |
| "colorful" | Violates void philosophy | "energy accents" |
| "bright background" | Destroys the void | "elevated surface" |
| "border around everything" | Clutter | "invisible separation" |

---

## Request Patterns

When asking for design work, use these patterns:

### For Darkness Issues
> *"This feels like stale milk / ash / gray brick. Make it feel like the void."*

### For Energy Placement
> *"The [element] should beam with energy."*  
> *"Add a glow to [element] — it's the primary action."*  
> *"This has too much blue — restrain the energy."*

### For Hierarchy Issues
> *"The [text] is too bright — make it soft/dim."*  
> *"This label should be ghost-level, it's not important."*

### For Spacing Issues
> *"This needs to breathe."*  
> *"The [element] feels cramped."*

### For Depth Issues
> *"This should recede into the void."*  
> *"Make [element] float above the surface."*  
> *"Create mesmerizing depth here."*

---

## Example Prompts (Copy-Paste Ready)

Here are complete prompt examples you can use or adapt:

---

### 🌑 Creating a New Panel from Scratch

**Prompt:**
> Design a settings panel in dark elegance style. The void is the base — near-black background with depth. The panel title should beam with energy. Use soft text for descriptions, dim text for secondary labels. The save button should glow when hovered. Make it breathe — generous spacing. No borders except a subtle energy line on the left edge. I want it mesmerizing.

---

### 🔧 Fixing a Panel That Looks Wrong

**Prompt:**
> This panel feels like stale milk / gray brick / ash. It's not dark elegance — it's just dark mode. Redesign it:
> - Make the background feel like the void (near-black, not gray)
> - The title should beam with energy, not just be blue text
> - Reduce the blue — right now energy is everywhere, it should only leak in 3-4 places max
> - The text hierarchy is flat — I need bright for primary, soft for body, dim for labels
> - Add depth — layers should recede into the void

---

### ✨ Adding Energy to a Specific Element

**Prompt:**
> The submit button feels dead. Make it beam with energy:
> - Fill with the energy color (#56C4FF)
> - Add a subtle glow around it (box-shadow with energy-subtle)
> - When hovered, the glow should intensify slightly
> - The icon inside should be bright white
> - Keep it restrained — this is the only energy point in the input area

---

### 📝 Fixing Text Hierarchy

**Prompt:**
> The text in this card is all the same brightness — no hierarchy. Fix it:
> - Card title: bright (rgba 255,255,255,0.92)
> - Body text: soft (lower contrast, readable but receding)
> - Metadata/timestamp: dim (almost fading into void)
> - Placeholder text: ghost (barely visible)
> - Make sure the title doesn't compete with the energy accents

---

### 📦 Creating a Modal/Dialog

**Prompt:**
> Design a confirmation modal in dark elegance:
> - Background: void surface (#101016), not the deepest abyss
> - It should float above the page — add shadow for depth
> - Title: beam with energy, centered
> - Body text: soft, generous line-height, breathe
> - Two buttons: Cancel is ghost-level, Confirm beams with energy
> - Subtle energy line around the modal border (leak effect)
> - The backdrop should be pure abyss with 0.8 opacity

---

### 🎯 Creating an Empty State

**Prompt:**
> Design an empty state for a list view:
> - A subtle ring or circle in the center — not solid, just an energy line forming a circle
> - The ring should have a faint inner glow (mesmerizing)
> - Below: one line of soft text explaining the empty state
> - Below that: dim text with a hint on what to do
> - No emoji, no illustrations — just the geometric energy ring
> - It should feel like a quiet room waiting to be filled

---

### 🔲 Creating a Card/Item Component

**Prompt:**
> Design a list item card in dark elegance:
> - Background: surface level (slightly elevated from void)
> - On hover: elevated level (float effect)
> - Left edge: thin energy line (2px, energy-subtle)
> - Title: bright text
> - Description: soft text, max 2 lines
> - Metadata on the right: dim text
> - No heavy borders — use background difference for separation
> - Spacing should breathe (padding 16-20px)

---

### ⌨️ Creating an Input Field

**Prompt:**
> Design a text input in dark elegance:
> - Background: void-deep level
> - Border: barely visible line (rgba 255,255,255,0.04)
> - On focus: border becomes energy-line, add faint glow around it
> - Text: bright when typing
> - Placeholder: ghost level
> - No inner shadow, no gradient background — keep it clean and void-like
> - Generous padding, comfortable for long text entry

---

### 🎚️ Creating a Toggle/Switch

**Prompt:**
> Design a toggle switch in dark elegance:
> - Off state: surface background, dim knob, no energy
> - On state: background fills with energy-subtle, knob glows with energy
> - The transition should feel like energy flowing into the void (future animation)
> - Keep it minimal — no labels inside the toggle
> - Size: comfortable for click, not oversized

---

### 📊 Creating a Header/Toolbar

**Prompt:**
> Design a toolbar header:
> - Background: surface with subtle gradient into void at the bottom
> - Logo/title on left: beam with energy
> - Navigation items: soft text, dim when inactive
> - Active nav item: bright text + small energy dot below
> - Actions on right: icon buttons, ghost level until hovered
> - Bottom edge: invisible or single line separator
> - Height: 56-64px, items centered vertically

---

### 🔄 Redesigning an Existing Component

**Prompt:**
> This dropdown menu looks like a standard dark mode component. Make it dark elegance:
> - Background should be void-surface, not gray
> - Items: soft text, comfortable padding (12-16px)
> - Hovered item: elevated background, not bright color
> - Selected item: energy dot on left, bright text
> - Dividers: line level (barely visible)
> - The whole menu should have subtle float shadow
> - Energy appears only on selected state, nowhere else

---

### 🌌 The Ultimate Dark Elegance Request

**Prompt:**
> Enter UI designer mindset. I want true dark elegance — not dark mode, not gray, not stale.
>
> The void is the base. Near-black. Mesmerizing depth. You should be able to stare at it for hours.
>
> Energy (#56C4FF) is precious. It escapes from the void only where meaning is highest — titles, active states, primary actions. Maybe 4-5 places total. It should glow, leak, beam — not splash everywhere.
>
> Text hierarchy: bright → soft → dim → ghost. Clear, readable, calm.
>
> Spacing: breathe. This is a 20-hour thinking room, not a cramped phone app.
>
> Borders: invisible where possible, line where necessary, energy-line for emphasis.
>
> Depth: layers recede into the void. Surfaces float. The eye should be drawn in.
>
> Make it beautiful. Make it restrained. Make it inevitable.

---

## The Arnvoid Palette (Reference)

```css
/* THE VOID */
--abyss: #08080c;
--void-deep: #0c0c12;
--void-surface: #101016;
--void-elevated: #14141c;

/* THE ENERGY */
--energy: #56C4FF;
--energy-glow: rgba(86, 196, 255, 0.8);
--energy-subtle: rgba(86, 196, 255, 0.15);
--energy-faint: rgba(86, 196, 255, 0.06);

/* TEXT */
--text-bright: rgba(255, 255, 255, 0.92);
--text-soft: rgba(200, 210, 225, 0.7);
--text-dim: rgba(140, 150, 170, 0.5);
--text-ghost: rgba(100, 110, 130, 0.4);

/* LINES */
--line: rgba(255, 255, 255, 0.04);
--line-edge: rgba(255, 255, 255, 0.08);
--line-energy: rgba(86, 196, 255, 0.12);
```

---

## The Mesmerizing Test

Before shipping any dark elegance design, ask:

1. **Is it truly dark?** — Can you stay in this room for 20 hours?
2. **Is energy restrained?** — Blue in ≤5 places?
3. **Does it have depth?** — Layers receding into void?
4. **Is text readable?** — Clear hierarchy: bright → soft → dim?
5. **Is it mesmerizing?** — Does it draw you in, not push you away?

If yes to all: **ship it**.

---

## Quick Reference Card

| Concept | Vocabulary | CSS Translation |
|---------|------------|-----------------|
| Background | void, abyss, surface | `#08080c` to `#14141c` |
| Accent | energy, glow, beam, leak | `#56C4FF` + box-shadow |
| Primary text | bright | `rgba(255,255,255,0.92)` |
| Secondary text | soft | `rgba(200,210,225,0.7)` |
| Tertiary text | dim | `rgba(140,150,170,0.5)` |
| Placeholder | ghost | `rgba(100,110,130,0.4)` |
| Separator | line, energy line | `rgba(255,255,255,0.04)` |
| Spacing | breathe | `padding: 24px`, `gap: 20px` |

---

*"The interface is a void. Light is precious. Color is energy that escapes from depth."*
