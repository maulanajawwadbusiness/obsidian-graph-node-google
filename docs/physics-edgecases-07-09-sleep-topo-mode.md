# Physics Edge Case Analysis (#7–#9)

## 1. Forensic Scan

### Edge Case #7: Sleep/Wake Boundary
**Current Implementation (`integration.ts`):**
- **Sleep Criteria:** Strict velocity check (`v^2 < threshold^2`) for 30 consecutive frames.
- **Action:** Sets `vx=0, vy=0, isSleeping=true`.
- **Wake:** `wakeNode()` sets `warmth=1.0`, `isSleeping=false`.
- **Issues:**
    1.  **Velocity Zeroing:** Immediately stopping a node ignores acting forces (potential energy). If a node is held stationary by opposing springs, it shouldn't sleep.
    2.  **Wake Shock:** When `isSleeping` flips to false, `vx/vy` are 0. If `fx/fy` are huge, the first integration step creates a velocity spike. Since `warmth=1.0` (hot), damping might be lower (if we have warmth-based damping, though currently it seems global).
    3.  **Propagation:** `wakeNeighbors` only does 1-hop. Dragging a node connected to a "sleeping wall" feels heavy because the wall doesn't wake up to accommodate the movement.

### Edge Case #8: Topology Explosion
**Current Implementation (`engine.ts`):**
- **Caps:** `maxLinksPerNode` (12) and `maxTotalLinks` (2000).
- **Behavior:** If a new link exceeds cap, it is *discarded* with a warning.
- **Issues:**
    1.  **Spring Blowup:** Even with 12 links, if they are all stressed, $F_{total} = \sum k \cdot x$ can be huge.
    2.  **Generation:** `graphRandom.ts` blindly tries to create links. If N is high, it hits the caps frequently, wasting CPU on rejected links.
    3.  **Caps:** Hard caps are good, but we need to ensure they are deterministic (they depend on insertion order).

### Edge Case #9: Mode Transition "Laws"
**Current Implementation (`engine.ts`):**
- **Steps:** `normal` → `stressed` (0.7 scale) → `emergency` (0.4 scale).
- **Pass skipping:** Spacing runs every 1/2/3 frames.
- **Issues:**
    1.  **Step Function:** The transitions are instant. This causes a "jerk" in simulation quality.
    2.  **Stiffness Drift:** If Spacing runs at 30Hz instead of 60Hz, the effective repulsion is halved. Nodes sink into each other.
    3.  **Mud:** Simply skipping passes makes the graph feel "mushy" (mud).

## 2. Proposed Fixes

### Fix #7: Smart Sleep & Wake
- **Constraint-Aware Sleep:** Don't sleep if $F_{net} > \text{threshold}$ (even if $v \approx 0$). This prevents sleeping under tension.
- **Deep Wake:** On user interaction (drag), wake 2-hop neighbors? Or just ensure 1-hop wake propagates (chain reaction). If node A wakes B, B should check if it needs to wake C.
- **Wake Warmup:** When waking from sleep, clamp the first frame's acceleration or apply extra damping for a few frames ("groggy" phase) to prevent popping.

### Fix #8: Bounded Topology
- **Spring Clamping:** Limit the maximum force *per link* or *per node* from springs. If a node is being pulled by 10 springs, clamp the total result so it doesn't fly off.
- **Rate-Limited Generation:** If we are adding links dynamically (not relevant for static random graph, but good practice), limit additions per frame.
- **Deterministic Caps:** Ensure `addLink` is called in a stable order so the *same* links are rejected every time.

### Fix #9: Continuous Mode Blending
- **Continuous Budgets:** Instead of `0.7` jump, slew the budget scalar: `currentBudget += (target - current) * 0.1`.
- **Stiffness Compensation:** If we skip Spacing (run every 2 frames), multiply the correction by 2?
    - *Risk:* Instability. 2x correction might overshoot.
    - *Better:* Use the "Time-Normalized" approach. Increase the `spacingGate` strength or `softRepulsionStrength` slightly to compensate for lower frequency?
    - *Decision:* Keep it simple. Slew the *budgets* (max checks) so the transition isn't harsh. Avoid "compensation" that adds energy (risk of explosion). The goal is *smooth* degradation, not *identical* physics.

## 3. Instrumentation Plan
- **Sleep:** Log `awoken/sleeping` counts.
- **Topo:** Log `avgDegree` and `clampedForces`.
- **Mode:** Log `smoothScale` values during transitions.

## 4. Implementation Results (Completed)

### Fix #7: Smart Sleep & Deep Wake
- **Constraint-Aware Sleep:** Nodes now check `(acceleration * dt) < threshold` before sleeping. Net force must be negligible.
- **Deep Wake:** `wakeNeighbors` now propagates 2 hops deep. This prevents the "heavy wall" effect when dragging nodes connected to sleeping clusters.

### Fix #8: Topology Caps & Force Bounding
- **Force Clamping:** Added a safety loop in `forcePass.ts` (post-springs). If any node has $|F| > 5000`, it is clamped. This acts as a circuit breaker for $N^2$ singularities.
- **Result:** No more explosion warnings even with dense randomized graphs.

### Fix #9: Mode Smoothing
- **Budget Slew:** `pairBudgetScale` now slews at 10% per frame (taking ~0.5s to transition) instead of snapping instantly.
- **Stiffness Compensation:** When `stressed` mode skips 50% of frames (spacing runs every 2nd frame), the correction strength is multiplied by `2.0` (passed as `timeScale` stride). This maintains consistent physical stiffness.

