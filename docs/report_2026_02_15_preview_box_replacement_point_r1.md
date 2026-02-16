# Report: Preview Box Replacement Point R1 (2026-02-15)

## Scope
Run 1 only: locate the primary placeholder render path and seam anchor.

## Search Notes
- `rg -n "onboarding.enterprompt.graph_preview_placeholder|GRAPH_PREVIEW_PLACEHOLDER_STYLE|PromptCard|EnterPrompt|renderScreenContent\(|AppShell" src/...`
- `rg -n "Sample graph preview" src\i18n\strings.ts`

## Findings
- The fake sample preview box is rendered in `PromptCard`.
- It is mounted by `EnterPrompt`, which is mounted from the prompt branch of `renderScreenContent`, called from `AppShell`.

## Evidence Anchors
- Placeholder label key render: `src/components/PromptCard.tsx:88`
- Placeholder wrapper JSX node: `src/components/PromptCard.tsx:87`
- Placeholder style token: `src/components/PromptCard.tsx:272`
- EnterPrompt mounts PromptCard: `src/screens/EnterPrompt.tsx:123`
- Prompt route mounts EnterPrompt: `src/screens/appshell/render/renderScreenContent.tsx:123`
- AppShell calls `renderScreenContent`: `src/screens/AppShell.tsx:328`
- English string source for key: `src/i18n/strings.ts:179`

## Component Tree
1. `src/screens/AppShell.tsx:328` `renderScreenContentByScreen(...)`
2. `src/screens/appshell/render/renderScreenContent.tsx:123` `<EnterPrompt ... />`
3. `src/screens/EnterPrompt.tsx:123` `<PromptCard ... />`
4. `src/components/PromptCard.tsx:87` preview placeholder wrapper
5. `src/components/PromptCard.tsx:88` placeholder label text via `t('onboarding.enterprompt.graph_preview_placeholder')`

## JSX Excerpt (Primary Placeholder Block)
```tsx
// src/components/PromptCard.tsx:84-130
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
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.md,.markdown,.txt"
                    multiple={true}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        if (files.length > 0) {
                            onPickFiles(files);
                        }
                        e.currentTarget.value = '';
                    }}
                />
                {attachedFiles.length > 0 && (
                    <>
                        <div style={FILE_CHIPS_ROW_STYLE}>
```

## Style Excerpt (Preview Geometry Contract)
```tsx
// src/components/PromptCard.tsx:272-289
const GRAPH_PREVIEW_PLACEHOLDER_STYLE: React.CSSProperties = {
    width: '100%',
    height: '200px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(255, 255, 255, 0.02)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PLACEHOLDER_LABEL_STYLE: React.CSSProperties = {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.35)',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};
```

## Recommended Swap Seam (Run 1 level)
- Primary seam is the wrapper at `src/components/PromptCard.tsx:87`.
- Keep the wrapper `div` using `GRAPH_PREVIEW_PLACEHOLDER_STYLE`; replace only its inner label child later.
- This keeps layout footprint and visual geometry stable while introducing `<SampleGraphPreview />` in next run.
