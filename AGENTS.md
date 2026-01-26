# AGENTS.md

> **purpose:** this file is the default doctrine for any ai code agent (cursor, copilot, claude, codex, gemini, etc.) working on **arnvoid**.  
> it should feel like a subconscious hum: reliable, disciplined, 60fps-safe, and maulana-aligned.

---

## 0) north star (what we’re building)
**arnvoid** is a **2d knowledge map**: users don’t stare at walls of text, they hold the *essence* of a document as dots + links, open a dot popup, and think with it.  
this repo is a **physics-first ui organism**: smooth at 60fps, with overlays/panels that never poison the engine.

---

## 1) absolute rules (non-negotiable invariants)
### 1.1 60fps is sacred
- never introduce heavy work into `requestAnimationFrame` paths.
- never add per-frame dom queries/loops beyond what already exists.
- avoid main-thread stalls; prefer workers for parsing/analysis.

### 1.2 no transitions unless explicitly requested
- do not add css transitions/animations by default.
- if user asks for “apple ux” *without* asking for transitions: focus on responsiveness, spacing, clarity, and input feel — not animations.

### 1.3 overlays must not break physics input
- any overlay/panel that covers canvas must **own pointer + wheel** in its region.
- stop propagation for `pointerdown/move/up/cancel` and `wheel` (use capture if needed).
- canvas must never react “under” an overlay.

### 1.4 keep architecture seams clean
- don’t entangle:
  - physics engine internals ↔ ui overlays
  - document parsing ↔ rendering engine
  - popup/chat ↔ document viewer internals
- use **adapter contracts** for cross-layer control (scroll/highlight later).

### 1.5 maulana naming + perception rules
- prefer the word **dot** (not node) in ui text and explanations.
- “subtle” visuals in this project are about **4× stronger** than typical subtle defaults (numbers/alpha/contrast).

---

## 2) default working mode (router behavior)
### 2.1 plan-first by default
unless the user clearly says **“implement now / write code now / execute now”**, do:
1) short intent recap
2) invariants checklist (what must not break)
3) minimal change plan (steps, no code)
4) verification checklist
5) max 3 blocking questions (only if truly necessary)

### 2.2 execute-now only with explicit authorization
if user says “implement now”:
1) intent recap
2) invariants checklist
3) minimal diff strategy
4) code changes
5) verification checklist
6) clearly state what wasn’t verified (if any)

### 2.3 never fake completion
- don’t say “fixed” unless tests/verification steps were run or explicitly marked as skipped.

---

## 3) project overview (current tech)
**stack (expected):**
- frontend: react + vite + typescript
- rendering: canvas-based physics map + overlay ui
- document parsing: worker-based pipeline producing `ParsedDocument`
- pdf parsing: pdf.js (text extraction) in worker

if anything differs, read `package.json` and follow the repo’s scripts.

---

## 4) architecture map (high level)
### 4.1 core surfaces
- **map surface:** `GraphPhysicsPlayground` owns canvas + input + bounds updates.
- **popup surface:** `NodePopup` + `MiniChatbar` rendered via portal overlay.
- **document surface (now):** simple preview / placeholder panels.
- **document viewer (future):** left-half window, engine router (`DocumentViewer.tsx` external integration later).

### 4.2 layering & z-index doctrine
- in-canvas overlays: ~100–200
- portal overlays: ~1000+ (popups/chat)
- debug overlay: ultra-top

rule: left panel must sit **above canvas** but **below portal popups**.

---

## 5) code style & reliability rules
### 5.1 typescript discipline
- avoid `any`. use `unknown` + narrow types or define interfaces.
- prefer explicit return types for exported functions.

### 5.2 modularize + log (organogenesis)
- break complex logic into modules (each module = organ).
- add detailed logs for stateful/timing-sensitive code (logs = sensory cortex).
- for perf issues: add *surgical counters* before optimizing.

### 5.3 minimal diffs
- prefer small, surgical patches.
- don’t refactor unrelated code while implementing a feature.

### 5.4 comments
- explain **why**, not what.
- for tricky invariants (pointer capture, bounds updates, portals), leave short “scar notes”.

---

## 6) document system rules (parsing + offsets)
- `ParsedDocument.text` is canonical plain text.
- any offsets/ranges are **js string indices** (utf-16 code units).
- clamp offsets to `[0, text.length]`.
- warnings (e.g. scanned pdf → empty text) must surface as safe UI states, never crashes.

---

## 7) ui/ux rules (maulana taste)
- prefer clear geometry, clean spacing, strong contrast.
- “warmth” comes from:
  - instant responsiveness
  - stable layout
  - predictable focus
  - no flicker
- do not add fancy motion to compensate for slow input. fix latency first.

---

## 8) operational commands (verify your work)
use repo scripts from `package.json`. common defaults:
- dev: `npm run dev`
- build: `npm run build`
- lint: `npm run lint`
- typecheck (if present): `npm run typecheck`
- tests (if present): `npm test` or `npm run test`

if scripts differ, report the correct ones you found.

---

## 9) don’ts (common failure traps)
- don’t add transitions by accident.
- don’t add global `window/document` pointer listeners unless explicitly needed and justified.
- don’t break pointer ownership: if overlay is open, canvas must not react under it.
- don’t change portal layering rules unless user asked.
- don’t introduce per-frame heavy dom scans (treewalker/highlight etc.) in rAF paths.

---

## 10) deliverable format (how to answer in chat)
### plan-first response format
- **intent**
- **invariants**
- **plan (steps)**
- **risks**
- **verification**

### execute-now response format
- **intent**
- **invariants**
- **patch summary**
- **files changed**
- **verification**
- **not verified (if any)**

---

## 11) commit convention (if user asks)
use conventional commits:
- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `chore: ...`

---

## 12) “subconscious hum” skill loading (optional but recommended)
if the repo contains `/skills`, treat these as procedural modules:
- always apply `maulana-core` behavior implicitly.
- use `router` logic implicitly to choose the right procedure:
  - repo scan for big bugs
  - perf guardian for 60fps/stutter
  - soul-to-ui for feel → ui translation
  - backend-enterprise for db/backend work
  - eval-harness for standardization

you should not require the user to name skills manually.
