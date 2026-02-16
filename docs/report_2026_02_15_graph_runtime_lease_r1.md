# Run 1 Report: Graph Runtime Lease Forensic Baseline

Date: 2026-02-15
Scope: Step 4 run 1 only (forensic reconfirm + invariant definition)

## 1. Prompt <-> Graph transition path (current truth)

Primary screen render routing:
- `src/screens/AppShell.tsx:465` builds `renderScreenContentByScreen(...)`.
- `src/screens/appshell/render/renderScreenContent.tsx:93` routes graph-class screens (`graph_loading`, `graph`) into a shared graph subtree.
- `src/screens/appshell/render/renderScreenContent.tsx:165` routes prompt screen into `EnterPrompt`.

Graph-class mount shape:
- `src/screens/appshell/render/renderScreenContent.tsx:97` documents warm-mount contract: graph-class screens share the same subtree and no screen key.
- Runtime mount is `GraphWithPending` at `src/screens/appshell/render/renderScreenContent.tsx:98`.

Prompt mount shape:
- `src/components/PromptCard.tsx:89` mounts `<SampleGraphPreview />` inside the preview wrapper.
- `src/components/SampleGraphPreview.tsx:107` mounts `<GraphPhysicsPlayground ... />` when preview sample payload is valid.

## 2. Current overlap controls already present

No animated graph boundary transitions:
- `src/screens/appshell/transitions/transitionContract.ts:27` sets onboarding->graph policy non-animated.
- `src/screens/appshell/transitions/transitionContract.ts:31` sets graph->graph non-animated.

Prompt direct jump guard:
- `src/screens/AppShell.tsx:221` guards prompt->graph direct transition and reroutes to `graph_loading`.

Graph-class crossfade host exclusion:
- `src/screens/AppShell.tsx:495` disables `OnboardingLayerHost` when current screen is graph-class.
- `src/screens/AppShell.tsx:498` also disables crossfade host if `fromScreen` is graph-class.

Conclusion:
- Existing flow strongly reduces overlap risk, but there is no explicit hard runtime ownership guard.

## 3. Exact runtime mount points for lease participation

Preview owner mount point:
- `src/components/SampleGraphPreview.tsx:107` (`GraphPhysicsPlayground`)

Graph-screen owner mount point:
- `src/screens/appshell/render/renderScreenContent.tsx:98` (`GraphWithPending`)

Runtime surface entry:
- `src/playground/GraphPhysicsPlayground.tsx:23` delegates into `GraphPhysicsPlaygroundContainer`.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1493` exports container.

## 4. Lifecycle invariant to enforce in step 4

Invariant set:
1. At most one active graph runtime lease at any time.
2. Owners are explicit: `graph-screen` or `prompt-preview`.
3. Graph screen priority is absolute.
4. If graph-screen mounts while preview lease is active, graph-screen preempts preview lease.
5. Denied preview lease must block preview runtime mount (fallback only).
6. Lease operations must be deterministic and dev-logged (acquire, deny, preempt, release, stale release ignored).

## 5. Plan-fit notes against current code

- Best graph seam is `renderScreenContent.tsx` at `GraphWithPending` mount, not `GraphScreenShell`.
- Warm-mount contract in graph-class screens must remain unchanged while adding guard.
- StrictMode is enabled (`src/main.tsx:15`), so stale-token-safe release handling is required.

## 6. Run 1 output

- Forensic lifecycle baseline captured.
- Invariants and priority rules locked for implementation runs 2-5.