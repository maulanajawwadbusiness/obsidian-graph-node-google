import React from 'react';
import { SIDEBAR_COLLAPSED_WIDTH_CSS } from '../appShellStyles';

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
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
};

const GRAPH_SCREEN_SIDEBAR_PANE_STYLE: React.CSSProperties = {
    width: SIDEBAR_COLLAPSED_WIDTH_CSS,
    minWidth: SIDEBAR_COLLAPSED_WIDTH_CSS,
    flex: '0 0 auto',
    height: '100%',
};

const GRAPH_SCREEN_PANE_STYLE: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: '100%',
    position: 'relative',
};

export function GraphScreenShell({ sidebarExpanded, children }: GraphScreenShellProps): JSX.Element {
    void sidebarExpanded;
    return (
        <div className="graph-screen-shell" data-graph-screen-root="1" style={GRAPH_SCREEN_SHELL_STYLE}>
            <div className="graph-screen-layout" style={GRAPH_SCREEN_LAYOUT_STYLE}>
                <div className="graph-screen-sidebar-pane" style={GRAPH_SCREEN_SIDEBAR_PANE_STYLE} />
                <div className="graph-screen-graph-pane" style={GRAPH_SCREEN_PANE_STYLE}>
                    {children}
                </div>
            </div>
        </div>
    );
}
