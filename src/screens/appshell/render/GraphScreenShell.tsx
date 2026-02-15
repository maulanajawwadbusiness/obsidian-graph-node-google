import React from 'react';

type GraphScreenShellProps = {
    children: React.ReactNode;
};

const GRAPH_SCREEN_SHELL_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100vh',
};

export function GraphScreenShell({ children }: GraphScreenShellProps): JSX.Element {
    return (
        <div className="graph-screen-shell" data-graph-screen-root="1" style={GRAPH_SCREEN_SHELL_STYLE}>
            {children}
        </div>
    );
}
