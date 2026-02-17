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
    const isDisposingRef = React.useRef(false);
    const layoutReleaseCountRef = React.useRef(0);
    const disposeSubscriberHitCountRef = React.useRef(0);
    const reacquireDuringDisposeWarnedRef = React.useRef(false);

    React.useLayoutEffect(() => {
        isDisposingRef.current = false;
        const result = acquireGraphRuntimeLease(owner, instanceIdRef.current);
        if (result.ok) {
            activeTokenRef.current = result.token;
            setLeaseState({ phase: 'allowed', token: result.token });
        } else {
            activeTokenRef.current = null;
            setLeaseState({
                phase: 'denied',
                activeOwner: result.activeOwner,
                activeInstanceId: result.activeInstanceId,
            });
        }
        return () => {
            isDisposingRef.current = true;
            const token = activeTokenRef.current;
            if (!token) return;
            activeTokenRef.current = null;
            releaseGraphRuntimeLease(token);
            if (import.meta.env.DEV) {
                layoutReleaseCountRef.current += 1;
                console.log(
                    '[GraphRuntimeLeaseBoundary] layout_release owner=%s count=%d',
                    owner,
                    layoutReleaseCountRef.current
                );
            }
        };
    }, [owner]);

    React.useEffect(() => {
        return () => {
            warnIfGraphRuntimeResourcesUnbalanced('GraphRuntimeLeaseBoundary.unmount');
        };
    }, []);

    React.useLayoutEffect(() => {
        isDisposingRef.current = false;
        return subscribeGraphRuntimeLease((snapshot) => {
            if (isDisposingRef.current) {
                if (import.meta.env.DEV) {
                    disposeSubscriberHitCountRef.current += 1;
                    if (disposeSubscriberHitCountRef.current <= 3) {
                        console.warn(
                            '[GraphRuntimeLeaseBoundary] subscriber_while_disposing owner=%s count=%d',
                            owner,
                            disposeSubscriberHitCountRef.current
                        );
                    }
                }
                return;
            }
            const token = activeTokenRef.current;
            if (token && isGraphRuntimeLeaseTokenActive(token)) return;
            if (snapshot.epoch === lastEpochAttemptRef.current) return;
            lastEpochAttemptRef.current = snapshot.epoch;

            if (isDisposingRef.current) {
                if (import.meta.env.DEV && !reacquireDuringDisposeWarnedRef.current) {
                    reacquireDuringDisposeWarnedRef.current = true;
                    console.warn('[GraphRuntimeLeaseBoundary] blocked_reacquire_during_dispose owner=%s', owner);
                }
                return;
            }
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
