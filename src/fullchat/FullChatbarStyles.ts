import type React from 'react';

export const VOID = {
    deepest: '#08080c',
    deep: '#0c0c12',
    surface: '#101016',
    elevated: '#14141c',
    textBright: 'rgba(255, 255, 255, 0.92)',
    textSoft: 'rgba(200, 210, 225, 0.7)',
    textDim: 'rgba(140, 150, 170, 0.5)',
    textInput: 'rgba(255, 255, 255, 0.85)',
    energy: '#56C4FF',
    energyGlow: 'rgba(86, 196, 255, 0.8)',
    energySubtle: 'rgba(86, 196, 255, 0.15)',
    energyFaint: 'rgba(86, 196, 255, 0.06)',
    line: 'rgba(255, 255, 255, 0.04)',
    lineEnergy: 'rgba(86, 196, 255, 0.12)',
};

export const PANEL_STYLE: React.CSSProperties = {
    flex: '0 0 30%',
    minWidth: '320px',
    maxWidth: '480px',
    height: '100%',
    background: `linear-gradient(180deg, ${VOID.deep} 0%, ${VOID.deepest} 100%)`,
    borderLeft: `1px solid ${VOID.lineEnergy}`,
    boxShadow: `inset 1px 0 20px ${VOID.energyFaint}`,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: VOID.textSoft,
    position: 'relative',
    pointerEvents: 'auto',
    '--panel-bg-rgb': '8, 8, 12',
    '--panel-bg-opacity': '1',
} as React.CSSProperties;

export const HEADER_STYLE: React.CSSProperties = {
    height: '56px',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${VOID.line}`,
    flexShrink: 0,
};

export const TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: VOID.energyGlow,
    textShadow: `0 0 20px ${VOID.energySubtle}`,
};

export const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: VOID.textDim,
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    borderRadius: '4px',
};

export const CONTEXT_BADGE_STYLE: React.CSSProperties = {
    padding: '12px 24px',
    background: VOID.surface,
    borderBottom: `1px solid ${VOID.line}`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

export const MESSAGES_WRAPPER_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
};

export const MESSAGES_CONTAINER_STYLE: React.CSSProperties = {
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    fontSize: '14px',
    lineHeight: '1.65',
    padding: '24px',
    paddingRight: 'var(--scrollbar-gutter, 12px)',
};

export const MESSAGE_STYLE_USER: React.CSSProperties = {
    alignSelf: 'flex-end',
    background: VOID.elevated,
    padding: '14px 18px',
    borderRadius: '8px',
    maxWidth: '85%',
    color: VOID.textBright,
    fontSize: '14px',
    lineHeight: '1.6',
    boxShadow: `inset 0 1px 0 ${VOID.line}`,
};

export const MESSAGE_STYLE_AI: React.CSSProperties = {
    alignSelf: 'flex-start',
    padding: '8px 0',
    maxWidth: '90%',
    color: VOID.textSoft,
    fontSize: '14px',
    lineHeight: '1.65',
};

export const INPUT_CONTAINER_STYLE: React.CSSProperties = {
    padding: '20px 24px',
    borderTop: `1px solid ${VOID.line}`,
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    background: VOID.surface,
};

export const INPUT_FIELD_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '8px 14px',
    fontSize: '14px',
    background: VOID.deep,
    border: `1px solid ${VOID.line}`,
    borderRadius: '8px',
    color: VOID.textInput,
    caretColor: VOID.energy,
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    fontFamily: 'inherit',
    lineHeight: '1.4',
};

export const EMPTY_STATE_STYLE: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    textAlign: 'center',
    gap: '16px',
};

export const JUMP_TO_LATEST_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '12px',
    right: '24px',
    background: VOID.elevated,
    border: `1px solid ${VOID.lineEnergy}`,
    borderRadius: '16px',
    padding: '6px 14px',
    color: VOID.textSoft,
    fontSize: '11px',
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'opacity 150ms ease',
};

export const MIN_HEIGHT = 36;
export const MAX_HEIGHT = 116;
export const SCROLL_BOTTOM_THRESHOLD = 50;
