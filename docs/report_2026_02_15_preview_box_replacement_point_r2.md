# Report: Preview Box Replacement Point R2 (2026-02-15)

## Scope
Run 2 only: confirm whether any additional preview-box variants exist.

## Search Notes
- `rg -n "onboarding.enterprompt.graph_preview_placeholder" src`
- `rg -n "GRAPH_PREVIEW_PLACEHOLDER_STYLE|PLACEHOLDER_LABEL_STYLE" src`
- `rg -n "height:\s*'200px'|borderRadius:\s*'12px'" src\components src\screens`
- `rg -n "<PromptCard|PromptCard\s*\(" src`

## Findings
- Preview placeholder render path is unique in runtime JSX: one site only.
- No alternative PromptCard usage in other screens.
- No conditional branch/feature flag wrapping the preview placeholder block inside `PromptCard`.

## Evidence Anchors
- Unique placeholder JSX usage: `src/components/PromptCard.tsx:87-88`
- Unique style token definitions: `src/components/PromptCard.tsx:272-289`
- PromptCard call sites:
  - declaration: `src/components/PromptCard.tsx:23`
  - usage: `src/screens/EnterPrompt.tsx:123`
- Prompt entry is through prompt render branch: `src/screens/appshell/render/renderScreenContent.tsx:123`

## Variant Audit
1. Literal/i18n label usage
- `t('onboarding.enterprompt.graph_preview_placeholder')` appears once in JSX: `src/components/PromptCard.tsx:88`.
- `src/i18n/strings.ts` contains translation values only (`:82`, `:179`), not extra render paths.

2. Visual signature search
- `height: '200px'` + `borderRadius: '12px'` for the preview wrapper found at `src/components/PromptCard.tsx:274-275`.
- Other `borderRadius: '12px'` hits exist in unrelated components (payment/modal), no extra preview surface.

3. Conditional rendering check
- In `PromptCard`, preview placeholder is inside the main return tree with no conditional guard around lines `87-89`.
- No `SHOW_*` preview feature flag in PromptCard or EnterPrompt.

4. Reuse surface check
- `PromptCard` is only mounted by `EnterPrompt` (`src/screens/EnterPrompt.tsx:123`).
- No other route mounts the preview placeholder.

## JSX Excerpt (Uniqueness Proof)
```tsx
// src/components/PromptCard.tsx:84-96
return (
    <div style={CARD_STYLE}>
        <div style={CARD_INNER_STYLE}>
            <div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
                <div style={PLACEHOLDER_LABEL_STYLE}>{t('onboarding.enterprompt.graph_preview_placeholder')}</div>
            </div>

            <div style={HEADLINE_STYLE}>
                {t('onboarding.enterprompt.heading')}
            </div>

            <div style={INPUT_PILL_STYLE}>
```

## Recommended Swap Seam (Run 2 confirmation)
- Keep using the single seam at `src/components/PromptCard.tsx:87-88`.
- No secondary seams need synchronization.
- Next replacement can be a focused edit in PromptCard only.
