type ResourceSnapshot = Record<string, number>;

const isDev = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const resourceCounts = new Map<string, number>();
const warnedSignatures = new Set<string>();
const warnedNegativeNames = new Set<string>();
const warnedUnbalancedSources = new Set<string>();

function bump(name: string, delta: 1 | -1): void {
    const current = resourceCounts.get(name) ?? 0;
    if (delta === -1 && current <= 0) {
        resourceCounts.set(name, 0);
        if (!warnedNegativeNames.has(name)) {
            warnedNegativeNames.add(name);
            const stack = new Error().stack ?? '';
            const stackLines = stack
                .split('\n')
                .slice(1, 4)
                .join(' | ')
                .trim();
            console.warn(
                '[ResourceTracker] attempted negative decrement clamped name=%s current=%d delta=%d stack=%s',
                name,
                current,
                delta,
                stackLines || '<none>'
            );
        }
        return;
    }
    const next = current + delta;
    resourceCounts.set(name, next);
}

export function trackResource(name: string): () => void {
    if (!isDev) return () => {};
    bump(name, 1);
    let released = false;
    return () => {
        if (released) return;
        released = true;
        bump(name, -1);
    };
}

export function getResourceTrackerSnapshot(): ResourceSnapshot {
    if (!isDev) return {};
    const out: ResourceSnapshot = {};
    resourceCounts.forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

export function warnIfGraphRuntimeResourcesUnbalanced(source: string): void {
    if (!isDev) return;
    const unbalanced: Array<[string, number]> = [];
    resourceCounts.forEach((count, name) => {
        if (!name.startsWith('graph-runtime.')) return;
        if (count === 0) return;
        unbalanced.push([name, count]);
    });
    if (unbalanced.length === 0) return;

    const signature = `${source}:${unbalanced.map(([name, count]) => `${name}=${count}`).join('|')}`;
    if (warnedUnbalancedSources.has(source) || warnedSignatures.has(signature)) return;
    warnedUnbalancedSources.add(source);
    warnedSignatures.add(signature);
    console.warn('[ResourceTracker] graph-runtime resources unbalanced at %s: %s', source, signature);
}
