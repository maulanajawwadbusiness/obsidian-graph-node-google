# Forensic Report: EnterPrompt Sidebar Persistence

Date: 2026-02-09
Scope: Scan and dissect all relevant system seams to implement persistent sidebar behavior for onboarding prompt screen.

## 1. Executive Summary

- Current sidebar expanded state is local-only in `src/screens/EnterPrompt.tsx`.
- The prompt screen unmounts when switching to graph, so local state is lost.
- Onboarding screen persistence in `AppShell` is currently disabled (`PERSIST_SCREEN = false`), so refresh also resets progress and UI state.
- Correct low-risk seam is to persist sidebar state at `AppShell` level and pass it down as controlled props to `EnterPrompt`.
- If this sidebar pattern is reused on graph canvas later, pointer shielding rules are mandatory to prevent canvas drag capture from stealing clicks.

## 2. What Exists Today (Ground Truth)

### 2.1 Sidebar ownership in EnterPrompt

File: `src/screens/EnterPrompt.tsx`

- Local state:
  - `const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);`
- Wiring:
  - `<Sidebar isExpanded={isSidebarExpanded} onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} />`

File: `src/components/Sidebar.tsx`

- Component is controlled and presentational:
  - Props: `isExpanded`, `onToggle`.
- No persistence logic inside sidebar component.

### 2.2 Screen lifecycle and mount boundaries

File: `src/screens/AppShell.tsx`

- Onboarding flow is state machine: `welcome1 -> welcome2 -> prompt -> graph`.
- Graph is mounted only when `screen === 'graph'`.
- Prompt screen unmounts on transition to graph.

Docs confirmation:
- `docs/system.md` says graph is isolated and mounted only on graph screen.

### 2.3 Existing persistence posture

File: `src/screens/AppShell.tsx`

- `PERSIST_SCREEN = false`.
- Session storage code exists behind this disabled flag for screen restoration.

Implication:
- Sidebar expanded state is not persisted across refresh.
- Screen state itself is also not persisted by default.

## 3. Why Sidebar State Is Lost

Sidebar expansion is currently tied to component instance lifecycle in `EnterPrompt`.
State resets when:

1. User transitions from `prompt` to `graph` and back.
2. User refreshes page.
3. Any remount of `EnterPrompt`.

This is expected behavior for local component state and not a bug in React.

## 4. Where Persistence Should Live

Preferred seam: `src/screens/AppShell.tsx`.

Reasoning:

1. `AppShell` already owns onboarding screen state and transition logic.
2. `AppShell` is above `EnterPrompt` and survives prompt remounts.
3. This avoids moving global providers or changing graph/document ownership.
4. Keeps `Sidebar` component pure and reusable.

Alternative (less preferred):

- Add a dedicated onboarding UI store.
- This is larger scope and not required for simple sidebar expand persistence.

## 5. How To Implement With Minimal Diff

Recommended minimal plan:

1. Add `enterPromptSidebarExpanded` state in `AppShell`.
2. Add storage key (for example `arnvoid_prompt_sidebar_v1`).
3. Hydrate once on app start from storage.
4. Persist on toggle updates.
5. Pass state and setter to `EnterPrompt` props.
6. Remove local sidebar state from `EnterPrompt`.

Storage choice:

- `sessionStorage`: persistence for current tab/session only.
- `localStorage`: persistence across browser restarts.

Both are valid; choose based on product intent.

## 6. Input, Overlay, and System Overlap Risks

### 6.1 Pointer capture risk if reused on graph screen

Current graph container captures pointer on `onPointerDown` in:
- `src/playground/GraphPhysicsPlayground.tsx`

Doctrine requires:

- Overlay wrappers must set `pointerEvents: 'auto'`.
- Overlay wrappers and all interactive children must call `onPointerDown={(e) => e.stopPropagation()}`.

Sources:
- `docs/system.md` overlay input safety section.
- `AGENTS.md` pointer safety rules.

Note:
- This is not currently a blocking risk for EnterPrompt because graph canvas is not mounted on prompt screen.
- It becomes critical if sidebar is later shared with graph UI.

### 6.2 Existing overlay precedence

`AppShell` tracks onboarding overlays and blocks fullscreen button interaction when overlays are open.

Any sidebar persistence implementation must not bypass overlay-open state flow.

### 6.3 Naming overlap risk

There are two sidebar concepts:

1. Onboarding left sidebar (`src/components/Sidebar.tsx` in EnterPrompt).
2. Graph debug controls sidebar (`SidebarControls` in playground).

Keep naming explicit in code and docs to avoid confusion.

## 7. Conflict and Quality Findings

### 7.1 ASCII policy conflict found

Files contain mojibake or non-ASCII artifacts:

- `src/components/Sidebar.tsx` separator comments render mojibake.
- `src/components/PromptCard.tsx` uses non-ASCII multiply symbol in dismiss text.
- `docs/FUTURE_TODO.md` has non-ASCII artifacts in some lines.

This conflicts with declared ASCII-only doctrine in project instructions.

### 7.2 TODO alignment

`docs/FUTURE_TODO.md` includes:
- "Build a collapsible left sidebar with a title bar, name, and account controls."

Persistence should be delivered as part of this roadmap item, not as a detached patch.

## 8. Decision Matrix

Option A: Persist in `EnterPrompt` only (localStorage/sessionStorage in component)

- Pros: small change.
- Cons: lower architectural coherence, harder reuse, more UI-specific logic in leaf screen.

Option B: Persist in `AppShell` and control EnterPrompt sidebar via props (recommended)

- Pros: clean ownership, survives remount, aligns with existing onboarding flow orchestration.
- Cons: requires small prop threading change.

Option C: Create dedicated onboarding UI store

- Pros: scalable for many onboarding UI states.
- Cons: more code and moving parts than needed now.

## 9. Recommended Implementation Contract

1. Single source of truth: `AppShell` for prompt sidebar expanded state.
2. Stateless `Sidebar` component remains unchanged.
3. `EnterPrompt` becomes controlled for sidebar expanded state.
4. Storage key is versioned.
5. No change to auth/session token storage policy.
6. If sidebar is ever mounted above graph canvas, apply pointer shielding pattern to all interactive elements.

## 10. Verification Checklist (Manual)

1. Expand sidebar on prompt, refresh page, verify expected persisted state.
2. Expand sidebar on prompt, go to graph, return to prompt path, verify state behavior.
3. Verify fullscreen button still blocks when overlays are open.
4. Verify payment panel and money notice overlays remain unaffected.
5. If reused on graph, verify sidebar buttons do not trigger canvas drag or missed click.

## 11. Files Examined

- `docs/system.md`
- `docs/repo_xray.md`
- `docs/FUTURE_TODO.md`
- `src/screens/AppShell.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/components/Sidebar.tsx`
- `src/components/PromptCard.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/config/onboardingUiFlags.ts`
- `src/config/env.ts`
- `src/i18n/lang.ts`

