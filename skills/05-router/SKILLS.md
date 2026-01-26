---
name: router
description: auto-selects the right skills for a task, enforces the two-phase contract (plan-first unless explicitly authorized), and prevents scope creep / sloppy execution.
triggers:
  - any request that involves coding, debugging, architecture, performance, ux, backend, or refactors
  - user says: "build", "implement", "fix", "refactor", "optimize", "make it", "ship", "urgent", "3am"
---

# router (maulana neutron-star garage)

## mission
turn vague human intent into an industrial procedure by selecting skill modules, locking invariants, and choosing the correct output mode.

this router does NOT do the work itself.
it chooses the right skills + sets the execution contract.

## always-on
always load:
- maulana-core

then choose additional skills based on the task classifier below.

## classifier (pick 1 primary lane, then optional boosters)

### lane A: repo-scale reasoning / hard bugs
choose when:
- "big repo", "scan", "dissect", "hard bug", "random", "frail", "edge case", "sometimes"
load:
- repo-grokker
- bug-hunter-edgecase
optional boosters:
- perf-60fps-guardian (if any stutter/lag/flicker)
- soul-to-ui (if user mentions feel/ux)

### lane B: ui/ux layout + interaction
choose when:
- "panel", "overlay", "sidebar", "z-index", "pointer events", "canvas", "popup", "portal", "no transition"
load:
- soul-to-ui (if any “feel” or “apple ux” wording)
- perf-60fps-guardian (if 60fps / smoothness mentioned)
- bug-hunter-edgecase (if “unbreakable” / “robust”)
mandatory invariant focus:
- pointer/wheel capture correctness
- no transitions unless asked

### lane C: performance / 60fps emergencies
choose when:
- "60fps", "stutter", "lag", "flicker", "perf", "freeze", "main thread"
load:
- perf-60fps-guardian
- bug-hunter-edgecase
optional boosters:
- repo-grokker (if repo is large / uncertain ownership)
mandatory invariant focus:
- measure-first
- counters/logs before refactor

### lane D: backend / database / enterprise
choose when:
- "backend", "db", "schema", "auth", "scale", "1000 users", "enterprise", "queue"
load:
- backend-enterprise
- bug-hunter-edgecase (for failure modes)
optional boosters:
- eval-harness (if “standardize” / repeatability asked)

### lane E: standardization / make it repeat forever
choose when:
- "standardize", "24 hour", "again again", "guarantee", "skills pack", "evaluation"
load:
- eval-harness
- repo-grokker (if tying to a specific repo)
optional boosters:
- perf-60fps-guardian (if UI/perf involved)

## output mode (critical)
default mode = PLAN-FIRST.
the router must decide one of these modes:

### mode 1: PLAN-FIRST (default)
use when:
- user did not explicitly authorize code changes
- task is risky, repo-wide, performance sensitive, or ambiguous
deliver:
1) intent recap (1–3 lines)
2) selected skills list + why
3) invariants checklist
4) implementation steps (no code)
5) verification checklist
6) questions only if truly blocking (max 3)

### mode 2: EXECUTE-NOW (only if user says so)
use when:
- user explicitly says "write code now" / "implement now" / "apply patch"
deliver:
1) intent recap (1–2 lines)
2) invariants checklist
3) minimal diff strategy
4) code / patch
5) verification checklist
6) what was not verified (if any)

### mode 3: DIAGNOSE-ONLY
use when:
- user says "just confirm you understand" / "no implementation" / "no suggestions"
deliver:
- understanding + risks list (no plan, no code)

## anti-sloppiness (for shaky executors like gemini3pro-low)
if the selected model is known to be sloppy:
- force PLAN-FIRST unless user says EXECUTE-NOW twice
- require “imports/types/wiring checklist” in verification section:
  - types compile
  - imports present
  - module wired into render tree / router
  - handlers attached to correct element
  - no dead code paths

## stop conditions (refuse to proceed)
router must stop and request info if any of these are missing:
- file paths for the touched components
- owner of event handlers (where pointer/wheel is attached)
- required invariants are unknown (z-index/pointer ownership/perf budget)
- user forbids questions but task is ambiguous enough to risk breakage
(in that case, output safest plan with assumptions clearly labeled)

## invocation examples (what the user can say)
- "router: plan only. no code." -> mode 1
- "router: execute now. minimal diff." -> mode 2
- "router: diagnose only." -> mode 3

## router final line
end every router run with one line:
"selected skills: <list>. mode: <mode>."
