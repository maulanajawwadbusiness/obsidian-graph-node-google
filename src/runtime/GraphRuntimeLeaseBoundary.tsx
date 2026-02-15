import React from 'react';
import {
    acquireGraphRuntimeLease,
    isGraphRuntimeLeaseTokenActive,
    releaseGraphRuntimeLease,
    subscribeGraphRuntimeLease,
    type GraphRuntimeOwner,
} from './graphRuntimeLease';
import { warnIfGraphRuntimeResourcesUnbalanced } from './resourceTracker';

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
    const activeTokenRef = React.useRef<string | null>(null);
    const lastEpochAttemptRef = React.useRef<number>(-1);

    React.useLayoutEffect(() => {
        const result = acquireGraphRuntimeLease(owner, instanceIdRef.current);
        if (result.ok) {
            activeTokenRef.current = result.token;
            setLeaseState({ phase: 'allowed', token: result.token });
            return;
        }
        activeTokenRef.current = null;
        setLeaseState({
            phase: 'denied',
            activeOwner: result.activeOwner,
            activeInstanceId: result.activeInstanceId,
        });
        return;
    }, [owner]);

    React.useEffect(() => {
        return () => {
            const token = activeTokenRef.current;
            if (token) {
                releaseGraphRuntimeLease(token);
                activeTokenRef.current = null;
            }
            warnIfGraphRuntimeResourcesUnbalanced('GraphRuntimeLeaseBoundary.unmount');
        };
    }, []);

    React.useEffect(() => {
        return subscribeGraphRuntimeLease((snapshot) => {
            const token = activeTokenRef.current;
            if (token && isGraphRuntimeLeaseTokenActive(token)) return;
            if (snapshot.epoch === lastEpochAttemptRef.current) return;
            lastEpochAttemptRef.current = snapshot.epoch;

            const reacquire = acquireGraphRuntimeLease(owner, instanceIdRef.current);
            if (reacquire.ok) {
                activeTokenRef.current = reacquire.token;
                setLeaseState({ phase: 'allowed', token: reacquire.token });
                return;
            }
            activeTokenRef.current = null;
            setLeaseState({
                phase: 'denied',
                activeOwner: reacquire.activeOwner,
                activeInstanceId: reacquire.activeInstanceId,
            });
        });
    }, [owner]);

    if (leaseState.phase === 'checking') {
        return <>{pendingFallback}</>;
    }
    if (leaseState.phase === 'denied' && blockOnDeny) {
        return <>{deniedFallback}</>;
    }
    return <>{children}</>;
};
