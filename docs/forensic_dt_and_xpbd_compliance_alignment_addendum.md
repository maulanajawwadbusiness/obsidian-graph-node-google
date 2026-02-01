# Forensic Catch-Up: DT & XPBD Compliance Alignment (Knife-Sharp)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROVEN & BINDING

## 1. DT Provenance Proof
We verify the Time Delta flow from input to consumption to guarantee units (Seconds).

**A. Source (Input -> Policy)**
-   **File:** `src/physics/engine/engineTick.ts`
-   **Line 41:** `export const runPhysicsTick = (engine..., dtIn: number) => {`
    -   `dtIn` is the raw input from the scheduler (typically seconds).
-   **Line 50:** `const policyResult = engine.timePolicy.evaluate(dtIn * 1000);`
    -   **PROOF:** Input is multiplied by 1000. `dtIn` is **Seconds**. `dtPolicy` takes **Milliseconds**.

**B. Policy (Clamp -> Output)**
-   **File:** `src/physics/engine/dtPolicy.ts`
-   **Line 57:** `if (dtUseMs > maxDtMs) { dtUseMs = maxDtMs; }`
    -   Clamps ms value (e.g., 50ms).
-   **Line 74:** `dtUseSec: dtUseMs / 1000.0,`
    -   **PROOF:** Returns explicit `dtUseSec` in **Seconds**.

**C. Consumption (The Single Truth)**
-   **File:** `src/physics/engine/engineTick.ts`
-   **Line 51:** `const dt = policyResult.dtUseSec;`
-   **Line 52:** `const dtRawMs = dtIn * 1000;` (Used for forensics only).
-   **Usage Proofs:**
    -   **Line 609 (Forces):** `applyForcePass(..., dt, ...)` -> Uses Seconds.
    -   **Line 633 (Stats):** `applyDragVelocity(..., dt, ...)` -> Uses Seconds.
    -   **Line 641 (Integration):** `integrateNodes(..., dt, ...)` -> Uses Seconds.

**D. Substepping**
-   **Current State:** The engine currently runs a **Single Step** structure (`engineTick.ts`).
-   **Trace:** `engineTick.ts` calls `integrateNodes` exactly **ONCE** per tick trace (Line 641).
-   **Verdict:** No substepping buffer currently active in the tick loop.
-   **XPBD Plan:** XPBD solver will run **Once** per tick (matching legacy budget). If `maxStepsPerFrame` > 1 is needed later, the outermost loop in `engineTick.ts` must change.

## 2. XPBD Math (The Single Convention)
We bind the XPBD solver to **Convention A** (Compliance/dt²).

**Variables:**
-   `C` : Constraint Error ($|x_1 - x_2| - restLen$).
-   `alpha` : Compliance parameter (Inverse Stiffness).
-   `lambda` : Lagrange multiplier (accumulated constraint force/impulse).
-   `dt` : Time step (Seconds, typically 0.016).

**Canonical Equations (Binding):**
```typescript
// 1. Compliance Scaling (XPBD)
// alpha is compliance (m/N).
// We scale it by dt^2 to relate to position.
const alphaTilde = compliance / (dt * dt);

// 2. Denominator (Sum of Inverse Masses + Alpha)
const wSum = nodeA.invMass + nodeB.invMass;
const denom = wSum + alphaTilde;

// 3. Delta Lambda (Correction Magnitude)
// C = currentDistance - restLength
// deltaLambda = (-C - alphaTilde * lambda) / denom;
const deltaLambda = (-C - alphaTilde * prevLambda) / denom;

// 4. Update Lambda
const newLambda = prevLambda + deltaLambda;
// Store newLambda for next frame (Warm Starting) if enabled.

// 5. Apply Position Correction
const impulse = deltaLambda; // Magnitude of correction
const corrX = (dx / dist) * impulse;
const corrY = (dy / dist) * impulse;

nodeA.x += corrX * nodeA.invMass;
nodeA.y += corrY * nodeA.invMass;
nodeB.x -= corrX * nodeB.invMass;
nodeB.y -= corrY * nodeB.invMass;
```

**Why Convention A?**
It separates the material property (`compliance`, fixed) from the timestep (`dt`). If `dt` shrinks, `alphaTilde` grows larger (stiffer), making the constraint solution converge faster per second, which is physically correct.

## 3. Map: Legacy K -> XPBD Compliance
**Legacy Truth:**
-   **File:** `src/physics/forces.ts` L366, L452.
-   **Formula:** `forceMagnitude = effectiveK * displacement`.
-   **Units:** `effectiveK` (0.2) is a simple Hooke's Law spring constant. $F = kx$.
-   **Values:** `springStiffness` = 0.2. `displacement` approx 0-50px. Force approx 0-10 units.

**XPBD Compliance Check:**
-   XPBD `alpha` = $1 / k$.
-   Legacy $k=0.2$ implies $alpha = 5.0$.
-   **BUT:** XPBD handles infinite stiffness ($alpha=0$) gracefully.
-   **Goal:** We want **Hard Shells** (Contact) and **Taught Springs** (Link).

**Proposed Compliance Table:**
| Component | Legacy K | Target Behavior | XPBD Compliance ($\alpha$) | Correction @ 10px Err (16ms) |
| :--- | :--- | :--- | :--- | :--- |
| **Hard Contact** | N/A | **Rigid (Solid)** | **0.00000** (Zero) | **10.0 px** (Full Snap) |
| **Link (Stiff)** | 0.2 | **Taught (Rope)** | **0.00001** (Near Zero) | ~9.9 px (Tight) |
| **Link (Soft)** | 0.05 | **Elastic** | **0.00500** | ~0.5 px (Visible Sag) |
| **Repulsion** | N/A | **Force Field** | N/A (Accel) | N/A |

**Initial Tuning:**
-   **Hard Constraints (Contact):** `alpha = 0`.
-   **Links:** `alpha = 0.0001` (Start very stiff to prove stability, then soften if needed).

**Why Stiff?**
The user request emphasizes "Knife-Sharp" and "Hard Constraints". A compliance of 0.0 guarantees the solver attempts full geometric resolution every tick.
