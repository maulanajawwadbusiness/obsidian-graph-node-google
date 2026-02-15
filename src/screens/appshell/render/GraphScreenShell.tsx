import React from 'react';
import {
    getSidebarWidthTransitionCss,
    SIDEBAR_COLLAPSED_WIDTH_CSS,
    SIDEBAR_EXPANDED_RESOLVED_WIDTH_CSS,
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
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

    React.useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setPrefersReducedMotion(media.matches);
        update();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    // Keep graph pane geometry synced to the same sidebar expanded state used by overlay Sidebar.
    const sidebarPaneWidth = sidebarExpanded ? SIDEBAR_EXPANDED_RESOLVED_WIDTH_CSS : SIDEBAR_COLLAPSED_WIDTH_CSS;
    const graphScreenSidebarPaneStyle: React.CSSProperties = {
        width: sidebarPaneWidth,
        transition: prefersReducedMotion ? 'none' : getSidebarWidthTransitionCss(sidebarExpanded),
        willChange: prefersReducedMotion ? undefined : 'width',
        flexShrink: 0,
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
