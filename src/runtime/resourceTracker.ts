type ResourceSnapshot = Record<string, number>;

const isDev = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const resourceCounts = new Map<string, number>();

function bump(name: string, delta: 1 | -1): void {
    const current = resourceCounts.get(name) ?? 0;
    const next = current + delta;
    resourceCounts.set(name, next);
    if (next < 0) {
        console.warn('[ResourceTracker] negative count name=%s count=%d', name, next);
    }
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
