# Center Nodes Stick Like Stickers — Deep Diagnosis

Below is a **no‑edit** diagnosis based strictly on the current pipeline and code. I trace the exact passes, map them to channels, then tie expected debug stats to the “sticker” symptom, rank root causes, and propose fixes without writing code.

---

# 1) Deep Diagnosis — Early Expansion Pass Trace (by channel)

> Phase = **early expansion** (pre‑roll already finished; energy > 0.7).
> This is the exact pass order in `PhysicsEngine.tick()` and how it affects center hubs.
> (See `src/physics/engine.ts` for the pipeline order.)

## A. Force channel (net accelerations)

**Passes:**
1. **`applyForcePass`** (non‑pre‑roll path):
   - `applyRepulsion`, `applyCollision`, `applySprings`, `applyBoundaryForce`
   - **Then scale by energy.**
   (See `src/physics/engine/forcePass.ts` & `src/physics/forces.ts`.)

**Effect on center nodes:**
- **Springs are deliberately softened for high‑degree nodes during early energy** (hub softening in `applySprings`, energy > 0.5).
- Repulsion and collision are symmetric in dense cores: many equal‑and‑opposite neighbors → **net force cancellation**.
- Springs have a **dead zone** around rest length → small deviations do **not** create restoring forces.

So the **force channel** for center hubs is **low magnitude and highly symmetric** early on.
This is visible as **low force totals** in the ForcePass stats for those nodes.

## B. Velocity channel (motion shaping & damping)

**Passes:**
1. **Integration (`integrateNodes`)**:
   - Converts force to velocity using **degree‑based mass/inertia** (heavier hubs).
   - Applies **unified damping**.
   - Applies **HubVelocityScaling** (additional damp for high degree).
   - Applies **CarrierFlowAndPersistence** (tiny tangential drift for trapped hubs).
   (See `src/physics/engine/integration.ts` and `src/physics/engine/velocityPass.ts`.)

2. **`applyExpansionResistance`** (velocity damping for multi‑connected nodes when energy > 0.7).
   (See `src/physics/engine/velocityPass.ts`.)

3. **Later velocity‑only constraints** (still in early expansion):
   - **`applyAngleResistanceVelocity`** only in emergency/forbidden zones, otherwise skipped in expansion.
   - **`applyDistanceBiasVelocity`** for near‑contact and penetration (outward bias + inward projection).
   (See `src/physics/engine/velocityPass.ts`.)

**Effect on center nodes:**
- **High‑degree hubs** suffer **triple velocity suppression**:
  1) **Higher effective mass** in integration (slower acceleration).
  2) **HubVelocityScaling** reduces velocity.
  3) **ExpansionResistance** damps velocity again.

- **CarrierFlowAndPersistence** adds tiny lateral drift *only if* trapped (low net force + low velocity), but the bias is **very small** (0.05 * fade) and the direction can be cleared if centroid direction is unreliable.
- **DistanceBiasVelocity** pushes outward if overlapping, but **also projects away inward components**, which can **erase tangential drift** unless it is already large.

**Net result:**
The **velocity channel dominates** center hubs with damping and cancellation; any small lateral drift is repeatedly attenuated before it can accumulate.

> **This is the mechanical “sticker” feel:** the system is actively removing motion in the velocity channel rather than lacking force.

## C. Constraint / correction channel (position corrections)

**Passes (only when !preRoll):**
- `applyEdgeRelaxation`
- `applySpacingConstraints` (gated off for energy > 0.7)
- `applyTriangleAreaConstraints` (very soft, hub‑skip)
- `applySafetyClamp` (hard correction for deep penetration; hubs skip at high energy)
- `applyCorrectionsWithDiffusion` (degree scaling + diffusion + budget clamp)
(See `src/physics/engine/constraints.ts` and `src/physics/engine/corrections.ts`.)

**Effect on center nodes during early expansion:**
- **SpacingConstraints are disabled** when energy > 0.7.
- **TriangleAreaConstraints** and **SafetyClamp** both **skip high‑degree hubs** during early energy and are weak.
- Corrections are then **degree‑scaled down** and **diffused** away from the hub even when they exist.

So the **constraint channel is essentially neutral** early on for center hubs, which keeps them in **equilibrium** rather than pushing them out.

---

### ✅ Which pass dominates center nodes?

**Dominant pass:**
**Velocity damping** (Integration mass + HubVelocityScaling + ExpansionResistance).
This dominates because force is soft/cancelled and corrections are gated.

### ✅ Which pass prevents lateral drift?

**Primary:** `applyExpansionResistance` + `applyHubVelocityScaling` (velocity channel)
**Secondary:** `applyDistanceBiasVelocity` (projects inward components; doesn’t add lateral/tangential drift)
This combination removes or neutralizes small lateral motion before it accumulates.

### ✅ Which pass keeps them in equilibrium?

**Force cancellation + force softening** in `applySprings` / `applyRepulsion` (force channel), plus
**Constraint gating** (spacing off, safety clamp skipped for hubs), keeping them “locked” in place.

---

# 2) Use Debug Stats — Expected Numbers (stuck center vs free)

The current debug stats are per‑pass aggregates (see `src/physics/engine/stats.ts`), but you can still reason about **per‑node contributions** by looking at which passes are adding to totals and which nodes are marked as affected.

### Expected per‑node patterns

| Metric | Stuck Center Hub | Free / Edge Node |
|---|---|---|
| **ForcePass.force** | **Low or near zero** due to symmetry + spring dead zone + hub softening | **Higher**, especially from repulsion/springs |
| **Integration.velocity** | **Low net velocity** (after heavy damping) | **Higher net velocity** |
| **HubVelocityScaling.velocity** | **High delta magnitude** (removing velocity) | **Low / none** |
| **ExpansionResistance.velocity** | **High delta magnitude** (damping applied) | **Low / none** |
| **CarrierFlow.velocity** | **Tiny**, only if trapped, often noisy | **Often zero** |
| **DistanceBiasVelocity.velocity** | **Moderate/high**, but net motion still low | **Moderate**, contributes to actual separation |
| **Corrections.correction** | **Very low** (spacing gated, hub‑skip, diffusion) | **Higher** once energy < 0.7 |
| **Safety.clampTriggers** | **Low** for hubs (skip during early energy) | **Possible** if penetrations exist |
| **Safety.correctionBudgetHits** | **Low early**, may rise later | **Potentially higher when constraints start** |

**Interpretation for a stuck hub:**
You should see **large velocity deltas in damping passes** (HubVelocityScaling, ExpansionResistance), but **low ForcePass and low net Integration velocity**. That’s classic “sticker” signature.

---

# 3) Root Cause (ranked)

**Most likely root cause (ranked):**

1) **Velocity‑channel suppression of hubs** during early expansion
   - **Integration mass scaling + HubVelocityScaling + ExpansionResistance** collectively crush hub velocity.
   - These act **every frame** and **only on high‑degree nodes**, which matches center nodes.

2) **Symmetric force cancellation + hub spring softening**
   - `applySprings` reduces force on hubs while repulsion cancels in dense core.
   - That makes hubs **force‑silent**, which then triggers low acceleration.

3) **Constraint gating (spacing off, safety clamp skip, correction diffusion)**
   - Constraints aren’t allowed to rescue them until later (energy <= 0.7).
   - This explains why they “break loose” around ~300–600ms.

> **Conclusion:**
> **Center nodes are stuck because the velocity channel (hub mass + hub scaling + expansion damping) dominates them during early expansion, while forces cancel and constraints are gated, leaving them in near‑equilibrium.**

---

# 4) Proposed Fixes (no code yet; 2–3 max)

All fixes use **existing mechanisms** (no randomness, no new forces).

## Fix A — Gate ExpansionResistance for trapped hubs

**Pass:** `applyExpansionResistance`
**Channel:** Velocity
**Change:** Skip or reduce expansion resistance **for hubs marked in escapeWindow or detected as trapped (low force + low velocity)**.
**Why it targets center nodes:**
Only trapped center hubs have these conditions. This releases the “sticker” damping while leaving the rest of the system unchanged.

---

## Fix B — Reduce hub softening in `applySprings` earlier

**Pass:** `applySprings` inside `applyForcePass`
**Channel:** Force
**Change:** Shorten or soften the **early‑phase hub softening** so hubs regain spring force sooner (e.g., scale out by energy sooner).
**Why it targets center nodes:**
Hubs are the only nodes suppressed by this logic. More force breaks symmetry and produces escape acceleration.

---

## Fix C — Re‑order hub velocity scaling to occur **after** distance bias

**Pass:** `applyHubVelocityScaling` (currently inside integration before later velocity passes)
**Channel:** Velocity
**Change:** Apply hub velocity scaling **after** `applyDistanceBiasVelocity`, so contact bias can push hubs out before damping.
**Why it targets center nodes:**
Center nodes are more likely in dense contact; letting distance bias act before damping gives them a deterministic escape vector without adding new forces.

---

# 5) Pick One Fix (cleanest)

### ✅ **Pick: Fix A — Gate ExpansionResistance for trapped hubs**

**Why this is the cleanest:**
- It **doesn’t add any new force** or randomness.
- It uses **existing intent**: “escape window” already marks nodes that are trapped by symmetric cancellation.
- It **targets only early expansion hubs**, which is exactly the sticky cluster.
- It preserves behavior elsewhere and respects the engine’s channel separation.

> **Final framing:**
> **Center nodes are stuck because velocity‑channel damping (ExpansionResistance + HubVelocityScaling + mass scaling) dominates them during early expansion while force is softened/cancelled and constraints are gated.**
> **Allowing trapped hubs to bypass ExpansionResistance removes the “sticker” without breaking the model.**

---

# Sources (files & commands referenced)

**Files:**
- `src/physics/engine.ts` (pass order & phase gating)
- `src/physics/engine/forcePass.ts` (force pass & pre‑roll behavior)
- `src/physics/forces.ts` (springs, repulsion, collision; hub softening)
- `src/physics/engine/integration.ts` (mass scaling, hub velocity scaling)
- `src/physics/engine/velocityPass.ts` (expansion resistance, distance bias, carrier flow, angle resistance)
- `src/physics/engine/constraints.ts` (spacing gate, safety clamp)
- `src/physics/engine/corrections.ts` (budgeting, diffusion)
- `src/physics/engine/stats.ts` (debug stats schema)

**Commands run:**
- `rg -n "physics|force|constraint|velocity|safety|debug stats|stats" src`
- `sed -n '1,220p' src/physics/engine.ts`
- `sed -n '220,520p' src/physics/engine.ts`
- `sed -n '1,220p' src/physics/engine/constraints.ts`
- `sed -n '220,520p' src/physics/engine/constraints.ts`
- `sed -n '1,200p' src/physics/engine/corrections.ts`
- `sed -n '1,240p' src/physics/engine/velocityPass.ts`
- `sed -n '240,520p' src/physics/engine/velocityPass.ts`
- `sed -n '520,980p' src/physics/engine/velocityPass.ts`
- `sed -n '1,240p' src/physics/engine/forcePass.ts`
- `sed -n '1,200p' src/physics/engine/stats.ts`
- `sed -n '1,200p' src/physics/engine/integration.ts`
- `sed -n '1,260p' src/physics/forces.ts`
