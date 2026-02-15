import React from 'react';
import {
    acquireGraphRuntimeLease,
    releaseGraphRuntimeLease,
    type GraphRuntimeOwner,
} from './graphRuntimeLease';

type LeaseBoundaryState =
    | { phase: 'checking' }
    | { phase: 'allowed'; token: string }
    | { phase: 'denied'; activeOwner: GraphRuntimeOwner; activeInstanceId: string };

type GraphRuntimeLeaseBoundaryProps = {
    owner: GraphRuntimeOwner;
    blockOnDeny?: boolean;
    pendingFallback?: React.ReactNode;
    deniedFallback?: React.ReactNode;
    children: React.ReactNode;
};

export const GraphRuntimeLeaseBoundary: React.FC<GraphRuntimeLeaseBoundaryProps> = ({
    owner,
    blockOnDeny = false,
    pendingFallback = null,
    deniedFallback = null,
    children,
}) => {
    const instanceIdRef = React.useRef(
        `${owner}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
    );
    const [leaseState, setLeaseState] = React.useState<LeaseBoundaryState>({ phase: 'checking' });

    React.useLayoutEffect(() => {
        const result = acquireGraphRuntimeLease(owner, instanceIdRef.current);
        if (result.ok) {
            setLeaseState({ phase: 'allowed', token: result.token });
            return () => {
                releaseGraphRuntimeLease(result.token);
            };
        }
        setLeaseState({
            phase: 'denied',
            activeOwner: result.activeOwner,
            activeInstanceId: result.activeInstanceId,
        });
        return undefined;
    }, [owner]);

    if (leaseState.phase === 'checking') {
        return <>{pendingFallback}</>;
    }
    if (leaseState.phase === 'denied' && blockOnDeny) {
        return <>{deniedFallback}</>;
    }
    return <>{children}</>;
};
