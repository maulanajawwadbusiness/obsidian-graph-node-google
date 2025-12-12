# graph physics vision – “obsidian feel” for sitasiai map

## 1. purpose

this document defines the **experience vision** for the 2d graph physics used in the sitasiai map.

we are not building a generic graph layout.

we are building a **feel-engine**:
a small universe where nodes behave like a living jelly of ideas,
inspired by obsidian’s graph view but tuned for our own product.

the physics exists to make users *feel* their paper as a living structure,
not as dead dots.

---

## 2. experience we want

### 2.1 high-level feeling

- the graph looks **alive, but not chaotic**.
- dots feel like **tiny planets** connected by **elastic threads**.
- when the user drags something, the map **responds as one body**.
- after a moment of movement, everything **settles into calm clarity**.

the user should subconsciously think:

> “this thing has weight, structure, and logic. i can *feel* the document.”

---

### 2.2 experience anchors (what must be true)

these are our **non-negotiable UX anchors**.  
if the engine violates these, it’s wrong, no matter how “correct” the math is.

#### anchor 1 – idle spacing

- many nodes with no links:
  - spread out naturally,
  - stop overlapping,
  - stop moving after a short time.
- the screen shows a comfortable cloud, not a tangled clump.

#### anchor 2 – friend distance (linked pair)

- two linked nodes:
  - settle at a clean, medium distance (rest length).
  - if pulled apart, they attract.
  - if pushed too close, they repel.
- visually feels like a spring at rest.

#### anchor 3 – drag-lag rubber

- dragging a node:
  - feels slightly heavy (not glued 1:1 to the cursor).
  - pulls neighbors; links stretch like rubber.
  - releasing the node:
    - it overshoots a bit,
    - then slides back into place.
- neighbors wobble briefly, then stop.

#### anchor 4 – cluster formation

- groups of strongly linked nodes form **clouds / islands**.
- different clusters push away from each other.
- user can visually see:
  - “this is one topic / part of the paper”
  - “this is another topic / part of the paper”

#### anchor 5 – calm-down time

- after a big disturbance (new graph, heavy drag):
  - graph wiggles for a short time,
  - then becomes still in **~1–3 seconds**.
- no permanent shaking, no explosive drift.

#### anchor 6 – center of mass

- the “center of activity” stays near the viewing area.
- graph does not drift off-screen.
- there is a soft pull toward a logical center (e.g. (0,0)).

#### anchor 7 – performance & scale

- up to ~400 nodes:
  - motion feels smooth enough (no jarring stutters).
- if there are more nodes:
  - engine may approximate forces,
  - but it should degrade gracefully instead of freezing.

---

## 3. what the user should see (visual scenarios)

### scenario a – opening a medium graph

- user opens a document with ~150 nodes.
- graph appears slightly jiggling, then settles.
- clusters appear as 3–6 islands.
- some nodes in the center, others orbiting.

### scenario b – dragging a central node

- user drags an important central node.
- nearby nodes follow a bit, like they are attached by elastic threads.
- further nodes shift slightly but not wildly.
- on release, the whole area “breathes” once and settles.

### scenario c – dense cluster

- user zooms into a dense area.
- nodes are close, but not on top of each other.
- dragging one node re-arranges nearby ones slightly,
  revealing structure without breaking everything.

---

## 4. physics design principles

1. **ux > math**
   - if mathematically correct forces feel bad, we change the forces.
   - comfort, clarity, and control are more important than purity.

2. **simple, explainable forces**
   - each force must be explainable in one sentence:
     - repulsion: “don’t sit on top of me.”
     - spring: “stay roughly this far from your friends.”
     - center gravity: “stay near the middle.”
     - damping: “calm down over time.”

3. **tunable behaviour**
   - devs should be able to change feel by editing config,
     not rewriting the engine.
   - parameters should be documented in UX terms:
     - “increase this = heavier drag”
     - “lower this = more jittery”

4. **separation of concerns**
   - physics engine is independent of rendering.
   - react components don’t know about forces,
     they just:
     - provide input (drag, time)
     - render positions.

---

## 5. success criteria

we consider v1 of this system “good enough” when:

1. all experience anchors are approximately satisfied.
2. the graph passes basic manual tests:
   - spacing test
   - friend-distance test
   - drag-lag test
   - cluster test
   - calm-down test
3. engineers / ai agents can read the physics code and say:
   - “i understand what each force does”
   - “i know which knob to turn to change the feel”

after that, we iterate only to refine feel and performance,
not to reinvent the core engine.

---
