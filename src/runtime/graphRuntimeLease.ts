export type GraphRuntimeOwner = 'graph-screen' | 'prompt-preview' | 'unknown';

type ActiveGraphRuntimeLease = {
    token: string;
    owner: GraphRuntimeOwner;
    instanceId: string;
};

export type GraphRuntimeLeaseAcquireSuccess = {
    ok: true;
    token: string;
};

export type GraphRuntimeLeaseAcquireFailure = {
    ok: false;
    activeOwner: GraphRuntimeOwner;
    activeInstanceId: string;
};

export type GraphRuntimeLeaseAcquireResult =
    | GraphRuntimeLeaseAcquireSuccess
    | GraphRuntimeLeaseAcquireFailure;

let activeLease: ActiveGraphRuntimeLease | null = null;
let leaseCounter = 0;

function isDev(): boolean {
    return import.meta.env.DEV;
}

function nextToken(owner: GraphRuntimeOwner): string {
    leaseCounter += 1;
    return `graph_runtime_lease:${owner}:${leaseCounter}`;
}

function logDev(event: string, message: string, ...args: Array<string | number>): void {
    if (!isDev()) return;
    console.log(`[GraphRuntimeLease] ${event} ${message}`, ...args);
}

function warnDev(event: string, message: string, ...args: Array<string | number>): void {
    if (!isDev()) return;
    console.warn(`[GraphRuntimeLease] ${event} ${message}`, ...args);
}

function createLease(owner: GraphRuntimeOwner, instanceId: string): GraphRuntimeLeaseAcquireSuccess {
    const token = nextToken(owner);
    activeLease = { token, owner, instanceId };
    logDev('acquire', 'owner=%s instanceId=%s token=%s', owner, instanceId, token);
    return { ok: true, token };
}

export function acquireGraphRuntimeLease(
    owner: GraphRuntimeOwner,
    instanceId: string
): GraphRuntimeLeaseAcquireResult {
    if (!activeLease) {
        return createLease(owner, instanceId);
    }

    if (owner === 'graph-screen') {
        if (activeLease.owner !== 'graph-screen') {
            const prevOwner = activeLease.owner;
            const prevInstanceId = activeLease.instanceId;
            warnDev(
                'preempt',
                'newOwner=%s newInstanceId=%s prevOwner=%s prevInstanceId=%s',
                owner,
                instanceId,
                prevOwner,
                prevInstanceId
            );
        }
        return createLease(owner, instanceId);
    }

    if (activeLease.owner === 'graph-screen') {
        warnDev(
            'deny',
            'requestOwner=%s requestInstanceId=%s activeOwner=%s activeInstanceId=%s',
            owner,
            instanceId,
            activeLease.owner,
            activeLease.instanceId
        );
        return {
            ok: false,
            activeOwner: activeLease.owner,
            activeInstanceId: activeLease.instanceId,
        };
    }

    warnDev(
        'deny',
        'requestOwner=%s requestInstanceId=%s activeOwner=%s activeInstanceId=%s',
        owner,
        instanceId,
        activeLease.owner,
        activeLease.instanceId
    );
    return {
        ok: false,
        activeOwner: activeLease.owner,
        activeInstanceId: activeLease.instanceId,
    };
}

export function releaseGraphRuntimeLease(token: string): void {
    if (!activeLease) {
        warnDev('stale_release_ignored', 'token=%s reason=no_active_lease', token);
        return;
    }
    if (activeLease.token !== token) {
        warnDev(
            'stale_release_ignored',
            'token=%s activeToken=%s activeOwner=%s activeInstanceId=%s',
            token,
            activeLease.token,
            activeLease.owner,
            activeLease.instanceId
        );
        return;
    }
    logDev(
        'release',
        'owner=%s instanceId=%s token=%s',
        activeLease.owner,
        activeLease.instanceId,
        activeLease.token
    );
    activeLease = null;
}

export function getActiveGraphRuntimeLease(): {
    activeOwner: GraphRuntimeOwner;
    activeInstanceId: string;
} | null {
    if (!activeLease) return null;
    return {
        activeOwner: activeLease.owner,
        activeInstanceId: activeLease.instanceId,
    };
}
