export type GraphRuntimeOwner = 'graph-screen' | 'prompt-preview' | 'unknown';

type ActiveGraphRuntimeLease = {
    token: string;
    owner: GraphRuntimeOwner;
    instanceId: string;
};

type GraphRuntimeLeaseCounters = {
    acquire: number;
    deny: number;
    preempt: number;
    release: number;
    staleReleaseIgnored: number;
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
const leaseCounters: GraphRuntimeLeaseCounters = {
    acquire: 0,
    deny: 0,
    preempt: 0,
    release: 0,
    staleReleaseIgnored: 0,
};

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
    leaseCounters.acquire += 1;
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
            leaseCounters.preempt += 1;
        }
        return createLease(owner, instanceId);
    }

    if (activeLease.owner === 'graph-screen') {
        leaseCounters.deny += 1;
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

    leaseCounters.deny += 1;
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
        leaseCounters.staleReleaseIgnored += 1;
        warnDev('stale_release_ignored', 'token=%s reason=no_active_lease', token);
        return;
    }
    if (activeLease.token !== token) {
        leaseCounters.staleReleaseIgnored += 1;
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
    leaseCounters.release += 1;
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

export function getGraphRuntimeLeaseDebugSnapshot(): {
    active: { owner: GraphRuntimeOwner; instanceId: string } | null;
    counters: GraphRuntimeLeaseCounters;
} {
    return {
        active: activeLease
            ? { owner: activeLease.owner, instanceId: activeLease.instanceId }
            : null,
        counters: { ...leaseCounters },
    };
}
