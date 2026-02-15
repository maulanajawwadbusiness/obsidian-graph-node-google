import React from 'react';
import {
    SIDEBAR_COLLAPSED_WIDTH_CSS,
    SIDEBAR_EXPANDED_MIN_WIDTH_CSS,
    SIDEBAR_EXPANDED_WIDTH_CSS,
    SIDEBAR_TRANSITION_CSS,
} from '../appShellStyles';

type GraphScreenShellProps = {
    sidebarExpanded: boolean;
    children: React.ReactNode;
};

const GRAPH_SCREEN_SHELL_STYLE: React.CSSProperties = {
    // Graph shell currently anchors full viewport space; runtime fills this container.
    position: 'relative',
    width: '100%',
    height: '100vh',
};

const GRAPH_SCREEN_LAYOUT_STYLE: React.CSSProperties = {
    // Graph screen uses two panes: reserved sidebar column on the left, graph runtime on the right.
    // Keep this layout below overlay/modal layers; do not introduce z-index here.
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
};

const GRAPH_SCREEN_PANE_STYLE: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: '100%',
    position: 'relative',
};

export function GraphScreenShell({ sidebarExpanded, children }: GraphScreenShellProps): JSX.Element {
    // Keep graph pane geometry synced to the same sidebar expanded state used by overlay Sidebar.
    const sidebarPaneWidth = sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH_CSS : SIDEBAR_COLLAPSED_WIDTH_CSS;
    const sidebarPaneMinWidth = sidebarExpanded ? SIDEBAR_EXPANDED_MIN_WIDTH_CSS : SIDEBAR_COLLAPSED_WIDTH_CSS;
    const graphScreenSidebarPaneStyle: React.CSSProperties = {
        width: sidebarPaneWidth,
        minWidth: sidebarPaneMinWidth,
        transition: SIDEBAR_TRANSITION_CSS,
        flex: '0 0 auto',
        height: '100%',
    };

    return (
        <div className="graph-screen-shell" data-graph-screen-root="1" style={GRAPH_SCREEN_SHELL_STYLE}>
            <div className="graph-screen-layout" style={GRAPH_SCREEN_LAYOUT_STYLE}>
                <div className="graph-screen-sidebar-pane" style={graphScreenSidebarPaneStyle} />
                <div className="graph-screen-graph-pane" style={GRAPH_SCREEN_PANE_STYLE}>
                    {children}
                </div>
            </div>
        </div>
    );
}
