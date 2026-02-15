import React from 'react';

export const SIDEBAR_COLLAPSED_WIDTH_PX = 35;
export const SIDEBAR_COLLAPSED_WIDTH_CSS = `${SIDEBAR_COLLAPSED_WIDTH_PX}px`;
export const SIDEBAR_EXPANDED_WIDTH_CSS = '10vw';
export const SIDEBAR_EXPANDED_MIN_WIDTH_PX = 200;
export const SIDEBAR_EXPANDED_MIN_WIDTH_CSS = `${SIDEBAR_EXPANDED_MIN_WIDTH_PX}px`;
export const SIDEBAR_EXPANDED_RESOLVED_WIDTH_CSS = `max(${SIDEBAR_EXPANDED_WIDTH_CSS}, ${SIDEBAR_EXPANDED_MIN_WIDTH_CSS})`;
// Shared sidebar geometry motion for overlay Sidebar and graph structural column.
export const SIDEBAR_EXPAND_DURATION_MS = 164;
export const SIDEBAR_COLLAPSE_DURATION_MS = 132;
export const SIDEBAR_EXPAND_TIMING_FUNCTION = 'cubic-bezier(0.20, 0.00, 0.00, 1.00)';
export const SIDEBAR_COLLAPSE_TIMING_FUNCTION = 'cubic-bezier(0.40, 0.00, 1.00, 1.00)';
export const SIDEBAR_EXPAND_TRANSITION_CSS =
    `width ${SIDEBAR_EXPAND_DURATION_MS}ms ${SIDEBAR_EXPAND_TIMING_FUNCTION}`;
export const SIDEBAR_COLLAPSE_TRANSITION_CSS =
    `width ${SIDEBAR_COLLAPSE_DURATION_MS}ms ${SIDEBAR_COLLAPSE_TIMING_FUNCTION}`;
export const getSidebarWidthTransitionCss = (expanded: boolean): string =>
    expanded ? SIDEBAR_EXPAND_TRANSITION_CSS : SIDEBAR_COLLAPSE_TRANSITION_CSS;

// Expanded content staging is asymmetric to keep expand smooth and collapse tight.
export const SIDEBAR_CONTENT_EXPAND_DURATION_MS = 108;
export const SIDEBAR_CONTENT_EXPAND_DELAY_MS = 16;
export const SIDEBAR_CONTENT_COLLAPSE_DURATION_MS = 88;
export const SIDEBAR_CONTENT_COLLAPSE_DELAY_MS = 0;
export const SIDEBAR_CONTENT_EXPAND_TIMING_FUNCTION = 'cubic-bezier(0.22, 0.00, 0.00, 1.00)';
export const SIDEBAR_CONTENT_COLLAPSE_TIMING_FUNCTION = 'cubic-bezier(0.40, 0.00, 1.00, 1.00)';
export const SIDEBAR_CONTENT_EXPAND_TRANSITION_CSS =
    `opacity ${SIDEBAR_CONTENT_EXPAND_DURATION_MS}ms ${SIDEBAR_CONTENT_EXPAND_TIMING_FUNCTION} ${SIDEBAR_CONTENT_EXPAND_DELAY_MS}ms, transform ${SIDEBAR_CONTENT_EXPAND_DURATION_MS}ms ${SIDEBAR_CONTENT_EXPAND_TIMING_FUNCTION} ${SIDEBAR_CONTENT_EXPAND_DELAY_MS}ms`;
export const SIDEBAR_CONTENT_COLLAPSE_TRANSITION_CSS =
    `opacity ${SIDEBAR_CONTENT_COLLAPSE_DURATION_MS}ms ${SIDEBAR_CONTENT_COLLAPSE_TIMING_FUNCTION} ${SIDEBAR_CONTENT_COLLAPSE_DELAY_MS}ms, transform ${SIDEBAR_CONTENT_COLLAPSE_DURATION_MS}ms ${SIDEBAR_CONTENT_COLLAPSE_TIMING_FUNCTION} ${SIDEBAR_CONTENT_COLLAPSE_DELAY_MS}ms`;
export const getSidebarContentTransitionCss = (expanded: boolean): string =>
    expanded ? SIDEBAR_CONTENT_EXPAND_TRANSITION_CSS : SIDEBAR_CONTENT_COLLAPSE_TRANSITION_CSS;
export const SIDEBAR_CONTENT_COLLAPSE_TOTAL_MS = SIDEBAR_CONTENT_COLLAPSE_DURATION_MS + SIDEBAR_CONTENT_COLLAPSE_DELAY_MS;

// Subtle visual rail transform to add smoothness without breaking straight geometry.
export const SIDEBAR_VISUAL_RAIL_HIDDEN_OFFSET_PX = 2;
export const SIDEBAR_VISUAL_RAIL_EXPAND_DURATION_MS = 120;
export const SIDEBAR_VISUAL_RAIL_COLLAPSE_DURATION_MS = 96;
export const SIDEBAR_VISUAL_RAIL_EXPAND_TIMING_FUNCTION = 'cubic-bezier(0.22, 0.00, 0.00, 1.00)';
export const SIDEBAR_VISUAL_RAIL_COLLAPSE_TIMING_FUNCTION = 'cubic-bezier(0.40, 0.00, 1.00, 1.00)';
export const SIDEBAR_VISUAL_RAIL_EXPAND_TRANSITION_CSS =
    `transform ${SIDEBAR_VISUAL_RAIL_EXPAND_DURATION_MS}ms ${SIDEBAR_VISUAL_RAIL_EXPAND_TIMING_FUNCTION}`;
export const SIDEBAR_VISUAL_RAIL_COLLAPSE_TRANSITION_CSS =
    `transform ${SIDEBAR_VISUAL_RAIL_COLLAPSE_DURATION_MS}ms ${SIDEBAR_VISUAL_RAIL_COLLAPSE_TIMING_FUNCTION}`;
export const getSidebarVisualRailTransitionCss = (expanded: boolean): string =>
    expanded ? SIDEBAR_VISUAL_RAIL_EXPAND_TRANSITION_CSS : SIDEBAR_VISUAL_RAIL_COLLAPSE_TRANSITION_CSS;
export const getSidebarVisualRailTransform = (expanded: boolean): string =>
    expanded ? 'translateX(0px)' : `translateX(-${SIDEBAR_VISUAL_RAIL_HIDDEN_OFFSET_PX}px)`;

export const NON_SIDEBAR_DIMMED_FILTER = 'brightness(0.8)';
export const NON_SIDEBAR_BASE_FILTER = 'brightness(1)';
export const NON_SIDEBAR_DIM_EXPAND_TRANSITION_CSS =
    `filter ${SIDEBAR_EXPAND_DURATION_MS}ms ${SIDEBAR_EXPAND_TIMING_FUNCTION}`;
export const NON_SIDEBAR_DIM_COLLAPSE_TRANSITION_CSS =
    `filter ${SIDEBAR_COLLAPSE_DURATION_MS}ms ${SIDEBAR_COLLAPSE_TIMING_FUNCTION}`;
export const getNonSidebarDimTransitionCss = (expanded: boolean): string =>
    expanded ? NON_SIDEBAR_DIM_EXPAND_TRANSITION_CSS : NON_SIDEBAR_DIM_COLLAPSE_TRANSITION_CSS;

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
    filter: NON_SIDEBAR_DIMMED_FILTER,
};

export const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
