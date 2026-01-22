/**
 * Document Viewer Theme Tokens
 * Independent from graph skin, allows comfortable reading in light or dark mode
 */

export type DocThemeMode = 'light' | 'dark';

export interface DocThemeTokens {
    // Typography
    fontFamily: string;
    fontSize: string;
    lineHeight: number;
    fontWeight: number;
    paragraphGap: string;
    maxLineWidth: string;

    // Colors
    panelBg: string;
    sheetBg: string;
    text: string;
    mutedText: string;
    selectionBg: string;
    selectionText: string;
    highlightActiveBg: string;
    highlightOtherBg: string;
}

export const DOC_THEME_DARK: DocThemeTokens = {
    fontFamily: "'Quicksand', 'Inter', system-ui, sans-serif",
    fontSize: '15px',
    lineHeight: 1.6,
    fontWeight: 300,
    paragraphGap: '0.75em',
    maxLineWidth: '68ch',
    panelBg: 'rgba(15, 15, 26, 0.98)',
    sheetBg: 'rgba(20, 22, 30, 1)',
    text: 'rgba(200, 210, 225, 0.92)',
    mutedText: 'rgba(140, 155, 175, 0.7)',
    selectionBg: 'rgba(99, 171, 255, 0.3)',
    selectionText: 'inherit',
    highlightActiveBg: 'rgba(255, 220, 100, 0.35)',
    highlightOtherBg: 'rgba(255, 220, 100, 0.15)',
};

export const DOC_THEME_LIGHT: DocThemeTokens = {
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '15px',
    lineHeight: 1.6,
    fontWeight: 400,
    paragraphGap: '0.75em',
    maxLineWidth: '68ch',
    panelBg: 'rgba(250, 250, 252, 0.98)',
    sheetBg: 'rgba(255, 255, 255, 1)',
    text: 'rgba(30, 30, 35, 0.92)',
    mutedText: 'rgba(100, 100, 110, 0.6)',
    selectionBg: 'rgba(99, 171, 255, 0.25)',
    selectionText: 'inherit',
    highlightActiveBg: 'rgba(255, 220, 100, 0.4)',
    highlightOtherBg: 'rgba(255, 220, 100, 0.2)',
};

export function getDocTheme(mode: DocThemeMode): DocThemeTokens {
    return mode === 'dark' ? DOC_THEME_DARK : DOC_THEME_LIGHT;
}

/**
 * Convert theme tokens to CSS variables (inline style object)
 */
export function docThemeToCssVars(theme: DocThemeTokens): React.CSSProperties {
    return {
        '--doc-font-family': theme.fontFamily,
        '--doc-font-size': theme.fontSize,
        '--doc-line-height': theme.lineHeight.toString(),
        '--doc-font-weight': theme.fontWeight.toString(),
        '--doc-paragraph-gap': theme.paragraphGap,
        '--doc-max-line-width': theme.maxLineWidth,
        '--doc-panel-bg': theme.panelBg,
        '--doc-sheet-bg': theme.sheetBg,
        '--doc-text': theme.text,
        '--doc-muted-text': theme.mutedText,
        '--doc-selection-bg': theme.selectionBg,
        '--doc-selection-text': theme.selectionText,
        '--doc-highlight-active-bg': theme.highlightActiveBg,
        '--doc-highlight-other-bg': theme.highlightOtherBg,
    } as React.CSSProperties;
}
