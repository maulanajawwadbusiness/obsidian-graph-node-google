import React from 'react';

// -----------------------------------------------------------------------------
// Configuration Knobs
// -----------------------------------------------------------------------------
export const SHOW_THEME_TOGGLE = true; // Set to false to hide theme toggle button

// -----------------------------------------------------------------------------
// Styles (Inline for simplicity, as requested)
// -----------------------------------------------------------------------------
export const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    // Use the app font defined in src/index.css (@font-face 'Quicksand')
    fontFamily: "'Quicksand', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
    background: '#111',
    color: '#eee',
};

export const MAIN_STYLE: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    cursor: 'grab',
};

export const SIDEBAR_STYLE: React.CSSProperties = {
    width: '320px',
    padding: '20px',
    background: '#222',
    borderLeft: '1px solid #444',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative', // allow absolute-positioned close button
};

export const DEBUG_OVERLAY_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '16px',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '4px',
    pointerEvents: 'auto',
    fontSize: '12px',
    // Inherit Quicksand from the playground container (src/index.css + CONTAINER_STYLE)
    fontFamily: 'inherit',
    // Allow synthetic bold (root disables it via `font-synthesis: none`)
    fontSynthesis: 'weight',
    zIndex: 10,
};

export const SIDEBAR_TOGGLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 10,
    background: 'rgba(0,0,0,0.55)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: 1,
    backdropFilter: 'blur(6px)',
};

export const DEBUG_TOGGLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 11,
    background: 'rgba(0,0,0,0.55)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: 1,
    backdropFilter: 'blur(6px)',
};

export const THEME_TOGGLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '80px', // Position after debug toggle
    zIndex: 11,
    background: 'rgba(0,0,0,0.55)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: 1,
    backdropFilter: 'blur(6px)',
};

export const DEBUG_CLOSE_STYLE: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#eee',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: 1,
};

export const SIDEBAR_CLOSE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#eee',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: 1,
};
