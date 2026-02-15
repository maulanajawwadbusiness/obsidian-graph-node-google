# Report: Preview Box Replacement Point R3 (2026-02-15)

## Scope
Run 3 only: define the safest replacement seam contract (no implementation).

## Decision
Use a minimal swap inside `PromptCard`.

## Exact Swap Seam
- File: `src/components/PromptCard.tsx`
- Replace target: `src/components/PromptCard.tsx:88`
- Keep wrapper: `src/components/PromptCard.tsx:87` (`<div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>`)

Current block:
```tsx
// src/components/PromptCard.tsx:87-89
<div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
    <div style={PLACEHOLDER_LABEL_STYLE}>{t('onboarding.enterprompt.graph_preview_placeholder')}</div>
</div>
```

## Swap Contract (minimal diff)
1. Keep outer wrapper node unchanged:
- `style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}`
- position in tree (before headline)
2. Replace only inner label node with:
- `<SampleGraphPreview />`
3. Do not alter siblings:
- headline block (`HEADLINE_STYLE`)
- input pill and upload flow

## Why this seam is safest
- Preserves existing layout geometry contract from wrapper style:
  - width `100%`, height `200px`, radius `12px`, muted border/background (`src/components/PromptCard.tsx:272-281`).
- Avoids cascading layout changes in `CARD_INNER_STYLE` spacing and prompt form alignment.

## Props/Styles to Preserve
- Preserve wrapper style object reference: `GRAPH_PREVIEW_PLACEHOLDER_STYLE` (`src/components/PromptCard.tsx:272`).
- Preserve wrapper placement in component order (preview first, heading second).
- Preserve `CARD_INNER_STYLE` gap rhythm by not removing wrapper node.

## Nearby Input/Event Risks (for next implementation)
1. Global wheel prevention during onboarding:
- Hook usage: `src/screens/AppShell.tsx:132-136`
- Guard impl: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:16-25`
- Impact: wheel interactions in future preview can be blocked at window-capture level.

2. Prompt-local stopPropagation zones in upload popup:
- `onPointerDown` / `onWheelCapture` / `onWheel` stop propagation at `src/components/PromptCard.tsx:167-171`, `176-179`.
- Impact: keep preview surface away from upload popup overlay interaction area.

3. EnterPrompt fixed overlays that can cover preview:
- Drag overlay fixed layer: `src/screens/EnterPrompt.tsx:186-195`
- Unsupported-file overlay fixed layer: `src/screens/EnterPrompt.tsx:226-234`
- Login overlay mount: `src/screens/EnterPrompt.tsx:161-167`
- Impact: preview visibility/input can be masked while overlays are active.

## Swap Patch Plan (no code)
- Replace lines:
  - `src/components/PromptCard.tsx:88` (inner placeholder label node)
- Keep wrapper A:
  - `src/components/PromptCard.tsx:87` (`<div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>`)
- Preserve style tokens:
  - `GRAPH_PREVIEW_PLACEHOLDER_STYLE` (`src/components/PromptCard.tsx:272-281`)
- Remove/retire placeholder-only inner node B:
  - `<div style={PLACEHOLDER_LABEL_STYLE}>{t('onboarding.enterprompt.graph_preview_placeholder')}</div>`

## Component Tree (final seam context)
1. `src/screens/AppShell.tsx:328` -> `renderScreenContent(...)`
2. `src/screens/appshell/render/renderScreenContent.tsx:123` -> `<EnterPrompt />`
3. `src/screens/EnterPrompt.tsx:123` -> `<PromptCard />`
4. `src/components/PromptCard.tsx:87-88` -> replacement seam
