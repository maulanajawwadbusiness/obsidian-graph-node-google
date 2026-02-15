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
    notifyCount: number;
    tokenInactiveChecks: number;
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

export type GraphRuntimeLeaseSnapshot = {
    activeOwner: GraphRuntimeOwner | null;
    activeInstanceId: string | null;
    activeToken: string | null;
    epoch: number;
};

type GraphRuntimeLeaseSubscriber = (snapshot: GraphRuntimeLeaseSnapshot) => void;

let activeLease: ActiveGraphRuntimeLease | null = null;
let leaseCounter = 0;
let leaseEpoch = 0;
const leaseSubscribers = new Set<GraphRuntimeLeaseSubscriber>();
let hasWarnedInvariant = false;
const leaseCounters: GraphRuntimeLeaseCounters = {
    acquire: 0,
    deny: 0,
    preempt: 0,
    release: 0,
    staleReleaseIgnored: 0,
    notifyCount: 0,
    tokenInactiveChecks: 0,
};

function isDev(): boolean {
    return import.meta.env.DEV;
}

function nextToken(owner: GraphRuntimeOwner): string {
    leaseCounter += 1;
    return `graph_runtime_lease:${owner}:${leaseCounter}`;
}

function buildSnapshot(): GraphRuntimeLeaseSnapshot {
    return {
        activeOwner: activeLease?.owner ?? null,
        activeInstanceId: activeLease?.instanceId ?? null,
        activeToken: activeLease?.token ?? null,
        epoch: leaseEpoch,
    };
}

function runLeaseInvariantSelfCheck(snapshot: GraphRuntimeLeaseSnapshot): void {
    if (!isDev()) return;
    if (hasWarnedInvariant) return;
    const activeFields = [snapshot.activeOwner, snapshot.activeInstanceId, snapshot.activeToken];
    const activeCount = activeFields.filter((value) => value !== null).length;
    const isConsistent = activeCount === 0 || activeCount === 3;
    if (isConsistent) return;
    hasWarnedInvariant = true;
    warnDev(
        'invariant_violation',
        'owner=%s instanceId=%s token=%s epoch=%d',
        snapshot.activeOwner ?? 'none',
        snapshot.activeInstanceId ?? 'none',
        snapshot.activeToken ?? 'none',
        snapshot.epoch
    );
}

function notifyLeaseSubscribers(): void {
    leaseCounters.notifyCount += 1;
    const snapshot = buildSnapshot();
    runLeaseInvariantSelfCheck(snapshot);
    for (const subscriber of leaseSubscribers) {
        try {
            subscriber(snapshot);
        } catch (error) {
            warnDev('subscriber_error', 'error=%s', error instanceof Error ? error.message : 'unknown');
        }
    }
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
    leaseEpoch += 1;
    leaseCounters.acquire += 1;
    logDev('acquire', 'owner=%s instanceId=%s token=%s', owner, instanceId, token);
    notifyLeaseSubscribers();
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
        notifyLeaseSubscribers();
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
    notifyLeaseSubscribers();
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
    leaseEpoch += 1;
    notifyLeaseSubscribers();
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

export function getGraphRuntimeLeaseSnapshot(): GraphRuntimeLeaseSnapshot {
    return buildSnapshot();
}

export function subscribeGraphRuntimeLease(subscriber: GraphRuntimeLeaseSubscriber): () => void {
    leaseSubscribers.add(subscriber);
    return () => {
        leaseSubscribers.delete(subscriber);
    };
}

export function isGraphRuntimeLeaseTokenActive(token: string): boolean {
    leaseCounters.tokenInactiveChecks += 1;
    return activeLease?.token === token;
}

export function assertActiveLeaseOwner(owner: GraphRuntimeOwner, token?: string): boolean {
    if (!import.meta.env.DEV) return true;
    const snapshot = buildSnapshot();
    if (snapshot.activeOwner !== owner) {
        warnDev(
            'assert_owner_mismatch',
            'expectedOwner=%s activeOwner=%s activeInstanceId=%s',
            owner,
            snapshot.activeOwner ?? 'none',
            snapshot.activeInstanceId ?? 'none'
        );
        return false;
    }
    if (token && snapshot.activeToken !== token) {
        warnDev(
            'assert_token_mismatch',
            'owner=%s expectedToken=%s activeToken=%s',
            owner,
            token,
            snapshot.activeToken ?? 'none'
        );
        return false;
    }
    return true;
}

export function getGraphRuntimeLeaseDebugSnapshot(): {
    active: { owner: GraphRuntimeOwner; instanceId: string; token: string } | null;
    epoch: number;
    counters: GraphRuntimeLeaseCounters;
} {
    return {
        active: activeLease
            ? { owner: activeLease.owner, instanceId: activeLease.instanceId, token: activeLease.token }
            : null,
        epoch: leaseEpoch,
        counters: { ...leaseCounters },
    };
}
