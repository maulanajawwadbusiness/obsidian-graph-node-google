# Forensic Report: Saved Interface Click From EnterPrompt Does Not Auto-Navigate

Date: 2026-02-10
Mode: Forensic only (no implementation)

## Root Cause Summary
Sidebar click sets `pendingLoadInterface` in AppShell, but on the EnterPrompt screen (`screen === 'prompt'`) AppShell does not navigate to `graph`. Graph restore logic only exists inside `GraphPhysicsPlayground`, which is mounted only when `screen === 'graph'`. So the intent is stored but never consumed until manual navigation/reload.

## 1) Sidebar Rendered on EnterPrompt and Graph

Evidence in `src/screens/AppShell.tsx`:
- Screen state type and owner:
  - `type Screen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';` at line 19
  - `const [screen, setScreen] = React.useState<Screen>(...)` at line 65
- Sidebar visibility is enabled for both prompt + graph:
  - `const showPersistentSidebar = screen === 'prompt' || screen === 'graph';` at line 78
- Sidebar render site:
  - conditional render `showPersistentSidebar ? <Sidebar ... />` starts at line 273

Conclusion:
- Sidebar is intentionally available in EnterPrompt and Graph.

## 2) Current Click Path for Saved Sessions

Evidence in `src/screens/AppShell.tsx`:
- Sidebar click handler:
  - `onSelectInterface={(id) => { ... setPendingLoadInterface(record); ... }}` at lines 282-287
- No screen navigation inside this handler.

Evidence in `src/screens/AppShell.tsx` + `src/playground/GraphPhysicsPlayground.tsx`:
- Graph mounts only when `screen === 'graph'`:
  - `const screenContent = screen === 'graph' ? <GraphWithPending ... /> : ...` at lines 224-237
- AppShell passes `pendingLoadInterface` into graph only in that graph branch:
  - prop pass at line 232
- Graph consumes restore intent only when mounted:
  - restore effect starts with `if (!pendingLoadInterface) return;` at line 695 in `src/playground/GraphPhysicsPlayground.tsx`
  - consume action `onPendingLoadInterfaceConsumed?.();` at line 705

Conclusion:
- In EnterPrompt, click sets pending intent, but Graph is not mounted, so no consume/restore occurs.

## 3) Exact Missing Navigation Step

Missing logic in `src/screens/AppShell.tsx`:
- In sidebar `onSelectInterface` (lines 282-287), there is no `setScreen('graph')` when current screen is `prompt`.
- Existing navigation to graph exists elsewhere (Enter/Skip flows):
  - `onEnter={() => setScreen('graph')}` at line 257
  - `onSkip={() => setScreen('graph')}` at line 258

Root missing step:
- After `setPendingLoadInterface(record)`, AppShell needs to transition to graph when not already on graph.

## 4) Required Minimal Behavior Definition

Desired sequence for click on EnterPrompt:
1. Resolve clicked record from `savedInterfaces`.
2. Set `pendingLoadInterface(record)`.
3. Navigate to graph (`setScreen('graph')`).
4. Graph mounts, receives `pendingLoadInterface` prop, consume effect runs once.
5. Restore map; no analysis pipeline should run.

Evidence that analysis is already gated during restore:
- Analysis effect exits when pending restore exists:
  - `if (pendingLoadInterface) return;` at line 842 in `src/playground/GraphPhysicsPlayground.tsx`

Conclusion:
- Proper navigation should not trigger analysis.

## 5) Minimal Fix Options (Ranked)

### Option A (Recommended): Navigate in Sidebar click handler
Change only AppShell sidebar select path:
- In `onSelectInterface`, after `setPendingLoadInterface(record)`, if `screen !== 'graph'`, call `setScreen('graph')`.

Why best:
- Least diff, explicit intent, no new global mechanism.
- Keeps ownership in AppShell (screen + sidebar state owner).
- Deterministic ordering: set intent first, then navigate.

### Option B: AppShell effect-based auto navigation
Add effect in AppShell:
- `useEffect(() => { if (pendingLoadInterface && screen !== 'graph') setScreen('graph'); }, [pendingLoadInterface, screen])`

Pros:
- Centralized rule.
Cons:
- Slightly broader behavior; can be less explicit and needs strict loop guard.

### Option C: Hidden graph mount / global intent consumer
Mount graph outside `screen === 'graph'` and consume intent globally.

Status:
- Not recommended. Larger architectural change and higher risk.

## 6) Edge Cases and Conflicts to Consider

- StrictMode double-render:
  - AppShell nav call must avoid loops; Option A is naturally one handler call per click.
- Rapid multiple clicks in EnterPrompt:
  - Last click should win; AppShell state overwrite semantics already do this.
- Restore vs default spawn race:
  - Existing restore/spawn guards in graph are already present (`default_spawn_skipped reason=pending_restore` path at lines 673-680 in `src/playground/GraphPhysicsPlayground.tsx`).
- No new UI:
  - Fix should remain plumbing-only.

## Recommended Minimal Fix Path

Use Option A in AppShell click handler:
- In `src/screens/AppShell.tsx` `onSelectInterface`:
  1. Find record.
  2. `setPendingLoadInterface(record)`.
  3. If `screen !== 'graph'`, `setScreen('graph')`.

Ordering requirement:
- `setPendingLoadInterface` before `setScreen('graph')` so first graph render already carries restore intent.

## Manual Validation Checklist (Post-Fix)

1. Start on EnterPrompt screen.
2. Click a saved interface in Sidebar `Your Interfaces`.
3. Verify immediate navigation to Graph screen.
4. Verify selected saved map restores automatically.
5. Verify no analysis flow starts (no pending analysis behavior).
6. While on Graph screen, click another saved interface; verify existing behavior still works.
7. Rapid-click two interfaces on EnterPrompt; verify last click wins.

## Verified / No Restore Changes Needed

Date: 2026-02-10

- Verified `onSelectInterface` ordering is correct in `src/screens/AppShell.tsx:282-289`: `setPendingLoadInterface(record)` executes before conditional `setScreen('graph')`.
- Verified no extra navigation churn on graph clicks: `setScreen('graph')` is guarded by `if (screen !== 'graph')` in `src/screens/AppShell.tsx:286-288`.
- Verified graph restore path is unchanged and still one-shot guarded in `src/playground/GraphPhysicsPlayground.tsx:695-706` (`hasConsumedLoadRef`, `isRestoringRef`, and `onPendingLoadInterfaceConsumed`).
- Verified analysis remains gated while restore intent exists: `if (pendingLoadInterface) return;` at `src/playground/GraphPhysicsPlayground.tsx:842`.
- Verified pending analysis is not triggered by sidebar click flow in AppShell; click handler only sets restore intent + optional navigation.
- Conclusion: no code changes were required beyond existing prompt->graph navigation fix; restore semantics on graph remain unchanged.

Smoke checklist re-validated:
1. Prompt -> click saved interface -> navigates to graph and restores.
2. Graph -> click saved interface -> restores without navigation churn.
3. Rapid clicks -> last click intent is the one consumed after graph mount.
