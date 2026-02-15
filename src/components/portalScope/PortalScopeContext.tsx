import React from 'react';

export type PortalScopeMode = 'app' | 'container';

type PortalScopeContextValue = {
    portalRootEl: HTMLElement | null;
    mode: PortalScopeMode;
};

type PortalScopeProviderProps = {
    children: React.ReactNode;
    portalRootEl?: HTMLElement | null;
    mode: PortalScopeMode;
};

const PortalScopeContext = React.createContext<PortalScopeContextValue | null>(null);

function resolveDocumentBody(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.body;
}

export const PortalScopeProvider: React.FC<PortalScopeProviderProps> = ({
    children,
    portalRootEl,
    mode,
}) => {
    const fallbackRoot = React.useMemo(() => resolveDocumentBody(), []);
    const value = React.useMemo<PortalScopeContextValue>(() => ({
        portalRootEl: portalRootEl ?? fallbackRoot,
        mode,
    }), [fallbackRoot, mode, portalRootEl]);

    return (
        <PortalScopeContext.Provider value={value}>
            {children}
        </PortalScopeContext.Provider>
    );
};

export function usePortalRootEl(): HTMLElement {
    const ctx = React.useContext(PortalScopeContext);
    const root = ctx?.portalRootEl ?? resolveDocumentBody();
    if (!root) {
        throw new Error('usePortalRootEl requires a browser document root');
    }
    return root;
}

export function usePortalScopeMode(): PortalScopeMode {
    const ctx = React.useContext(PortalScopeContext);
    return ctx?.mode ?? 'app';
}

export function usePortalBoundsRect(): DOMRect | null {
    const root = React.useContext(PortalScopeContext)?.portalRootEl ?? resolveDocumentBody();
    if (!root) return null;
    return root.getBoundingClientRect();
}
