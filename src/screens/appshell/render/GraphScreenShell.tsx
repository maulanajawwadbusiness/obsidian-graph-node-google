import React from 'react';

type GraphScreenShellProps = {
    children: React.ReactNode;
};

export function GraphScreenShell({ children }: GraphScreenShellProps): JSX.Element {
    return (
        <div className="graph-screen-shell" data-graph-screen-root="1">
            {children}
        </div>
    );
}
