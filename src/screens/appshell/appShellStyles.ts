import React from 'react';

export const SIDEBAR_COLLAPSED_WIDTH_PX = 35;
export const SIDEBAR_COLLAPSED_WIDTH_CSS = `${SIDEBAR_COLLAPSED_WIDTH_PX}px`;

export const FALLBACK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1115',
    color: '#e7e7e7',
    fontSize: '14px',
};

export const SHELL_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
};

export const MAIN_SCREEN_CONTAINER_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
};

export const NON_SIDEBAR_LAYER_STYLE: React.CSSProperties = {
    width: '100%',
    minHeight: '100vh',
};

export const NON_SIDEBAR_DIMMED_STYLE: React.CSSProperties = {
    filter: 'brightness(0.8)',
};

export const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
