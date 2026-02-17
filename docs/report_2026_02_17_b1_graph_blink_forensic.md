# B1 Graph Blink Forensic

Date: 2026-02-17
Scope: Prompt -> sidebar/search -> open existing saved interface (B1), forensic-only scan.

## 1) Reproduction Steps And Observed Timeline

Environment note:
- This session is terminal-only, so direct visual browser confirmation was not possible here.
- Timeline below is reconstructed from current control flow and existing log hooks.

Repro path:
1. Start on `prompt`.
2. Open saved interface from sidebar row or search result.
3. Observe post-fade graph reveal.

Reconstructed timeline (from code + logs):
- T0: selection sets `pendingLoadInterface` and starts nav_restore fade.
  - `src/screens/AppShell.tsx:734`
  - `src/screens/AppShell.tsx:738`
- T1: B1 intentionally bypasses `graph_loading` and transitions directly to `graph`.
  - `src/screens/AppShell.tsx:748`
  - `src/screens/AppShell.tsx:409`
- T2: graph restore effect consumes pending load immediately and clears AppShell pending state early.
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:989`
- T3: nav_restore marks `ready` only from `screen==='graph' && pendingLoadInterface===null` (no paint/lease readiness check).
  - `src/screens/AppShell.tsx:946`
  - `src/screens/AppShell.tsx:949`
  - `src/screens/AppShell.tsx:950`
- T4: fade exits after min time + ready latch; reveal can happen while graph runtime path is still stabilizing.
  - `src/screens/AppShell.tsx:1076`
  - `src/screens/AppShell.tsx:1101`

## 2) Exact Suspected Root Cause (Primary Hypothesis)

Primary root cause:
- Nav_restore fade readiness is keyed to `pendingLoadInterface` clearing, but that flag is cleared at restore start, not at stable first graph paint.
- In parallel, graph screen mount path includes runtime-lease and suspense fallback surfaces that can transiently replace canvas during first-mount churn.

Evidence points:
- Early-ready latch:
  - Ready condition only checks `screen==='graph'` and `pendingLoadInterface===null`.
  - `src/screens/AppShell.tsx:949`
  - `src/screens/AppShell.tsx:950`
- Pending load is cleared immediately at restore start:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:989`
- Graph render path has two fallback surfaces that can flash if mount/lease settles late:
  - Suspense fallback: `src/screens/appshell/render/renderScreenContent.tsx:119`
  - Lease boundary pending fallback: `src/screens/appshell/render/renderScreenContent.tsx:124`
  - Lease boundary starts in `checking`: `src/runtime/GraphRuntimeLeaseBoundary.tsx:34`
  - `checking` returns fallback: `src/runtime/GraphRuntimeLeaseBoundary.tsx:122`
- Prompt has active sample graph runtime and lease owner before B1 transition:
  - `src/components/PromptCard.tsx:93`
  - `src/components/SampleGraphPreview.tsx:312`

## 3) Why It Produces "Appear -> Disappear -> Appear"

Mechanism (most likely):
1. Nav fade is allowed to exit once `pendingLoadInterface` is cleared, which happens at restore start.
2. During/after this reveal window, graph subtree can still hit first-mount stabilization surfaces (Suspense/lease pending fallback).
3. User sees graph surface, then a brief fallback/blank layer, then graph surface again after mount settles.

This pattern is consistent with the reported blink timing: right after nav_restore fade completion.

## 4) Candidate Fixes (High Level, Ranked)

1. Bedrock-safe: change nav_restore ready latch to first-stable-graph signal, not `pendingLoadInterface===null`.
- Keep fade until graph runtime emits a "ready for reveal" signal (for B1 restore path).
- Quality: highest correctness; aligns transition ownership with visible readiness.

2. Medium-safe: suppress graph fallbacks during nav_restore epoch.
- For active nav_restore, avoid rendering fallback surfaces that can replace canvas (`Suspense`/lease pending fallback) until commit.
- Quality: good UX patch, but more coupling between transition layer and runtime layer.

3. Lower-safe tactical: minimum post-ready hold (extra delay) before fade exit.
- Add a short stabilization buffer after current ready latch.
- Quality: easiest, but time-based and less deterministic.

## 5) Dev-Only Vs Prod

Assessment:
- There is a credible dev-only amplifier: `React.StrictMode` is enabled in `src/main.tsx:15`, which can increase mount/effect churn during first render.
- Root timing bug (early ready latch) is not inherently dev-only, so a smaller flash may still be possible in production if runtime/lease/suspense is late.

Status:
- Direct visual A/B (`npm run dev` vs `npm run build && npm run preview`) was not executed interactively in this terminal-only run.
- Confidence: high on early-latch mismatch; medium on exact magnitude in prod.
