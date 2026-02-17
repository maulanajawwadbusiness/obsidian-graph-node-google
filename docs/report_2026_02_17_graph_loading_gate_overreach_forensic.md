# Graph Loading Gate Overreach Forensic (2026-02-17)

## 1) Symptom Summary
Users see the full `graph_loading` gate (Loading text + Confirm reveal contract) in flows that are simple navigation/restore from prompt, not only prompt submit analysis.

Observed overreach pattern:
- Any prompt-screen route that tries to go to `graph` is funneled to `graph_loading`.
- This includes prompt sidebar/select restore paths, not only Send/analysis.

## 2) Expected vs Actual (A, B1, B2, B3)

| Flow | Owner Intent | Actual Behavior | Verdict |
| --- | --- | --- | --- |
| A. Prompt input -> Send -> analysis -> new graph | Use `graph_loading` + gate Confirm | Uses `graph_loading` and gate Confirm | Correct |
| B1. Prompt -> sidebar -> open existing graph (restore/nav) | Bypass gate, only simple 200ms fade | Routed to `graph_loading` and Confirm gate | Overreach |
| B2. Graph -> sidebar -> select other saved graph | Bypass gate, only simple 200ms fade | Stays in graph-class (`graph`), no forced `graph_loading` transition | Not overreach in current code |
| B3. Graph -> sidebar -> return to prompt | Bypass gate, only simple 200ms fade | Direct `graph -> prompt`, no `graph_loading` hop | Not overreach in current code |

## 3) Inventory: All `graph_loading` Entry Points

| File:Line | Function | Trigger Action | Category |
| --- | --- | --- | --- |
| `src/screens/appshell/screenFlow/screenFlowController.ts:3` and `src/screens/appshell/screenFlow/screenFlowController.ts:8` | `PROMPT_FORWARD_GRAPH_CLASS_TARGET`, `getNextScreen` map | Prompt forward mapping defines `prompt -> graph_loading` as canonical next | A + contributes to B1 |
| `src/screens/appshell/render/renderScreenContent.tsx:207` | Prompt `onEnter` handler | EnterPrompt `onEnter` transition (`getNextScreen('prompt')`) | A (Send path), also non-send prompt continue paths |
| `src/screens/appshell/render/renderScreenContent.tsx:210` | Prompt `onSkip` handler | Prompt skip transition hardcoded to `graph_loading` | Non-A path, gate path by design |
| `src/screens/AppShell.tsx:356` and `src/screens/AppShell.tsx:361` | `transitionWithPromptGraphGuard` | Any `prompt -> graph` request is rerouted to `graph_loading` | Primary B1 overreach mechanism |
| `src/screens/AppShell.tsx:487` and `src/screens/AppShell.tsx:492` | `selectSavedInterfaceById` | Prompt sidebar select existing interface calls guard with `'graph'`, then reroutes to `graph_loading` | B1 overreach |
| `src/screens/AppShell.tsx:847` and `src/screens/AppShell.tsx:848` | `selectSearchResultById` | Search overlay result selection delegates to `selectSavedInterfaceById`, same reroute | B1 overreach |
| `src/screens/appshell/overlays/useAppShellModals.ts:157` and `src/screens/appshell/overlays/useAppShellModals.ts:161` | `selectSearchResultById` (modal state) | Search pick calls AppShell select callback | B1 feeder path |
| `src/screens/appshell/overlays/ModalLayer.tsx:407` and `src/screens/appshell/overlays/ModalLayer.tsx:458` | Search input Enter/click result | User picks saved interface from Search overlay UI | B1 feeder path |
| `src/screens/appshell/screenFlow/screenStart.ts:28` and `src/config/env.ts:17` | `getInitialScreen`, `parseOnboardingStartScreen` | DEV/startup can start at `graph_loading` via env | Dev entry only |
| `src/screens/AppShell.tsx:533` | `window.__arnvoid_setScreen` debug hook | DEV manual force to `graph_loading` | Dev entry only |

Gate mount branch (where the above entries become visible gate UI):
- `src/screens/appshell/render/renderScreenContent.tsx:117` enters graph-class branch.
- `src/screens/appshell/render/renderScreenContent.tsx:146` mounts `<GraphLoadingGate ...>` only when `screen === 'graph_loading'`.

## 4) Root Cause Narrative
The overreach is structural, not accidental branch leakage.

`graph_loading` was made the canonical prompt-forward graph-class route:
- screen flow maps prompt next to `graph_loading` (`screenFlowController`), and
- AppShell guard force-reroutes any direct `prompt -> graph` transition to `graph_loading` (`transitionWithPromptGraphGuard`).

Restore/open-existing from prompt sidebar uses the same forward route as analysis by design:
- selecting a saved interface sets `pendingLoadInterface`,
- then requests transition to `graph`,
- prompt guard intercepts and reroutes to `graph_loading`.

Gate intent model explicitly treats both analysis and restore as gate intents:
- `getGateEntryIntent` returns `analysis` if `pendingAnalysis`, else `restore` if `pendingLoadInterface` (`src/screens/appshell/render/graphLoadingGateMachine.ts:38`).
So B1 is currently classified the same gate pipeline as A.

B2 and B3 do not currently force `graph_loading`:
- B2 (`graph` sidebar select): `selectSavedInterfaceById` does not transition when already graph-class (`src/screens/AppShell.tsx:491`).
- B3 (`graph` sidebar create new): direct `transitionToScreen(getCreateNewTarget())` where target is `prompt` (`src/screens/AppShell.tsx:994`, `src/screens/appshell/screenFlow/screenFlowController.ts:29`).

## 5) Minimal Separation Idea (No Code, Future Work)
Introduce explicit transition intent modes at AppShell boundary: `analysis_gate` vs `nav_restore`.

- `analysis_gate`: prompt submit/file send path only. Route through `graph_loading`, keep Confirm contract.
- `nav_restore`: prompt/sidebar/search open existing path. Route directly to `graph` with lightweight 200ms nav fade, no Confirm gate.

Keep restore payload mechanics (`pendingLoadInterface`) unchanged; only decouple screen transition policy from restore intent. This preserves warm-mount/runtime contracts while separating UX policy.

## Verification Notes
Quick repro click paths:
- A: Prompt type text -> Send -> enters `graph_loading` -> Confirm appears.
- B1 overreach (sidebar row): Prompt -> Sidebar -> click saved interface row -> enters `graph_loading`.
- B1 overreach (search): Prompt -> Sidebar -> Search Interfaces -> pick result -> enters `graph_loading`.
- B2 current behavior: Graph -> Sidebar -> click other saved interface -> stays on `graph` (restore applies without gate hop).
- B3 current behavior: Graph -> Sidebar -> Create New -> goes to `prompt` directly.

DEV instrumentation already present:
- Gate mount/unmount counters at `src/screens/appshell/render/GraphLoadingGate.tsx:147` (`window.__arnvoidDebugCounters.graphLoadingGateMountCount` / `graphLoadingGateUnmountCount`).
- No runtime count snapshot was collected in this forensic pass (static scan only).
