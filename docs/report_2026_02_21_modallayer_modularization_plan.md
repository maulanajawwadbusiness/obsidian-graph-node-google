# ModalLayer Modularization Plan (Target: <450 Lines)

Date: 2026-02-21
Scope: `src/screens/appshell/overlays/ModalLayer.tsx`
Current size: 855 lines
Goal: reduce to under 450 lines with clear concern ownership and no modal/input regressions.

## 1. Problem Statement

`ModalLayer.tsx` currently combines:
- four distinct modal domains (profile, logout confirm, delete confirm, search)
- shared pointer/wheel hard-shield handling
- search keyboard navigation logic
- text normalization/truncation utilities
- all style tokens for every modal
- modal-root render orchestration

This causes poor locality and high regression surface when changing any modal.

## 2. Non-Negotiable Invariants

Must preserve exactly:
- modal layer remains top overlay and input black hole above sidebar/graph
- every interactive modal surface continues to block pointer + wheel propagation
- click backdrop closes each modal with current behavior
- search keyboard contract remains:
  - `Escape` closes
  - `ArrowUp/ArrowDown` controls highlight
  - `Enter` picks highlighted item
- search scrollbar class/theme remains `search-interfaces-scroll`
- profile/logout/delete callback behavior and disabled/busy states remain identical

## 3. Target Architecture

Create a focused module namespace:
- `src/screens/appshell/overlays/modalLayer/`

### 3.1 Orchestrator

- `src/screens/appshell/overlays/ModalLayer.tsx`
  - composition only
  - owns visibility gating and mounting order
  - target size: 220-380 lines

### 3.2 Shared Layer Modules

- `src/screens/appshell/overlays/modalLayer/types.ts`
  - exported models and props:
  - `ModalLayerProfileModel`, `ModalLayerLogoutModel`, `ModalLayerDeleteConfirmModel`, `ModalLayerSearchModel`, `ModalLayerProps`
- `src/screens/appshell/overlays/modalLayer/utils.ts`
  - `normalizeSearchText`, `truncateDisplayTitle`
- `src/screens/appshell/overlays/modalLayer/inputShield.ts`
  - shared hard-shield handlers and helper props
- `src/screens/appshell/overlays/modalLayer/styles.ts`
  - modal style objects (all current constants)

### 3.3 Modal Components

- `src/screens/appshell/overlays/modalLayer/ProfileModal.tsx`
- `src/screens/appshell/overlays/modalLayer/LogoutConfirmModal.tsx`
- `src/screens/appshell/overlays/modalLayer/DeleteConfirmModal.tsx`
- `src/screens/appshell/overlays/modalLayer/SearchInterfacesModal.tsx`

### 3.4 Search-Specific Hook

- `src/screens/appshell/overlays/modalLayer/useSearchKeyboard.ts`
  - encapsulates keydown behavior and highlighted-index update policy

## 4. Sharp Concern Management Rules

Rules:
- each modal component renders only its own domain UI + domain handlers
- shared input shield logic must be imported, never redefined inline repeatedly
- style definitions must be data-only in `styles.ts`
- search keyboard logic must live in `useSearchKeyboard` (single source of truth)
- `ModalLayer.tsx` only composes modal components and passes models

Anti-patterns to avoid:
- one file owning multiple modal body JSX trees
- duplicate `e.stopPropagation()` blocks on every control without shared helper
- modal-specific business logic inside orchestrator

## 5. Refactor Sequence

Phase 1: Static extraction
1. Move all exported model types and local props to `types.ts`.
2. Move utility helpers to `utils.ts`.
3. Move all style constants to `styles.ts`.

Phase 2: Shared shield extraction
1. Add `inputShield.ts` with reusable shield prop bag and stop helpers.
2. Replace repeated inline shield handlers with imported helper.
3. Verify pointer/wheel containment manually before continuing.

Phase 3: Split modal domains
1. Extract `ProfileModal`.
2. Extract `LogoutConfirmModal`.
3. Extract `DeleteConfirmModal`.
4. Keep callback and disabled/busy semantics unchanged.

Phase 4: Search modal split
1. Extract `SearchInterfacesModal`.
2. Extract keyboard handler logic to `useSearchKeyboard`.
3. Keep class names/data attributes used by existing CSS and test hooks.

Phase 5: Orchestrator cleanup
1. Reduce `ModalLayer.tsx` to:
   - root shield container
   - early return when all closed
   - ordered conditional rendering of 4 modal components
2. Enforce file size under 450 lines.

## 6. Line Budget Targets

Budgets:
- `src/screens/appshell/overlays/ModalLayer.tsx`: 220-380
- `ProfileModal.tsx`: 120-220
- `LogoutConfirmModal.tsx`: 90-180
- `DeleteConfirmModal.tsx`: 90-180
- `SearchInterfacesModal.tsx`: 180-320
- `useSearchKeyboard.ts`: 80-180
- `styles.ts`: unconstrained data-only file

Constraint:
- avoid creating any replacement file above ~500 lines.

## 7. Verification Matrix (Manual Required)

Layer and shielding:
- opening any modal blocks graph and sidebar interaction beneath
- pointer and wheel events inside modal do not leak to canvas

Profile modal:
- avatar, inputs, save/cancel flow unchanged
- save disabled/loading state unchanged
- error rendering unchanged

Logout modal:
- cancel and confirm actions unchanged
- busy state disables actions and text state is unchanged
- error message rendering unchanged

Delete modal:
- pending title/id text rendering unchanged
- cancel and delete callbacks unchanged

Search modal:
- close button, backdrop click, and escape behavior unchanged
- arrow navigation and enter selection unchanged
- highlight behavior on mouse enter unchanged
- empty state and recent label behavior unchanged
- `search-interfaces-scroll` class preserved

Rendering order:
- modal stacking order matches previous z-index and open precedence behavior

## 8. Risks and Mitigations

Risk: pointer leak after split.
Mitigation: mandatory shared shield helper and audit of every interactive element.

Risk: search keyboard regressions.
Mitigation: isolate keyboard policy into one hook with parity-first logic copy.

Risk: style drift between modal components.
Mitigation: centralized `styles.ts` and no ad-hoc inline overrides unless already present.

Risk: model prop drift across AppShell call site.
Mitigation: keep exported model types stable and re-export from existing `ModalLayer.tsx` entry.

## 9. Definition of Done

Done when:
- `src/screens/appshell/overlays/ModalLayer.tsx` is under 450 lines
- each modal concern has its own component/hook ownership
- shielding and keyboard contracts remain parity-safe
- this plan/report is committed alongside modularization work

