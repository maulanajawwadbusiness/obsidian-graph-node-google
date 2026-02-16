import type { GraphViewport } from '../viewport/graphViewport';
import { SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR } from '../../components/sampleGraphPreviewSeams';

type BoxedUiCounters = {
    boxedBodyPortalAttempts: number;
    boxedBodyPortalRedirectCount: number;
    boxedSurfaceDisabledCount: number;
};

const isDev = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const counters: BoxedUiCounters = {
    boxedBodyPortalAttempts: 0,
    boxedBodyPortalRedirectCount: 0,
    boxedSurfaceDisabledCount: 0,
};
const warnedBodyPortal = new Set<string>();
const warnedMissingPortalTarget = new Set<string>();
const warnedMissingPreviewRoot = new Set<string>();
const warnedSurfaceDisabled = new Set<string>();

export const BOXED_NODE_POPUP_SCALE = 0.4;

function warnOnce(set: Set<string>, key: string, message: string): void {
    if (!isDev) return;
    if (set.has(key)) return;
    set.add(key);
    console.warn(message);
}

export function isBoxedUi(viewport: GraphViewport): boolean {
    return viewport.mode === 'boxed';
}

export function isContainerPortalMode(mode: 'app' | 'container'): boolean {
    return mode === 'container';
}

export function assertNoBodyPortalInBoxed(portalTarget: HTMLElement, debugName: string): void {
    if (!isDev) return;
    if (typeof document === 'undefined') return;
    if (portalTarget !== document.body) return;
    counters.boxedBodyPortalAttempts += 1;
    warnOnce(
        warnedBodyPortal,
        debugName,
        `[BoxedUiPolicy] body portal attempt blocked surface=${debugName}`
    );
}

export function assertBoxedPortalTarget(portalTarget: HTMLElement | null | undefined, debugName: string): void {
    if (!isDev) return;
    if (typeof document === 'undefined') return;
    if (!portalTarget) {
        warnOnce(
            warnedMissingPortalTarget,
            debugName,
            `[BoxedUiPolicy] missing portal target surface=${debugName}`
        );
        return;
    }
    assertNoBodyPortalInBoxed(portalTarget, debugName);
}

export function resolveBoxedPortalTarget(
    portalTarget: HTMLElement | null | undefined,
    debugName: string
): HTMLElement | null {
    if (typeof document === 'undefined') return portalTarget ?? null;
    if (!portalTarget) {
        assertBoxedPortalTarget(portalTarget, debugName);
        return null;
    }
    if (portalTarget !== document.body) return portalTarget;
    assertNoBodyPortalInBoxed(portalTarget, debugName);
    const previewPortalRoot = document.querySelector(SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR);
    if (previewPortalRoot instanceof HTMLElement) {
        counters.boxedBodyPortalRedirectCount += 1;
        return previewPortalRoot;
    }
    warnOnce(
        warnedMissingPreviewRoot,
        debugName,
        `[BoxedUiPolicy] missing preview portal root surface=${debugName}`
    );
    return null;
}

export function countBoxedSurfaceDisabled(debugName: string): void {
    if (!isDev) return;
    counters.boxedSurfaceDisabledCount += 1;
    warnOnce(
        warnedSurfaceDisabled,
        debugName,
        `[BoxedUiPolicy] boxed surface disabled due to missing safe container surface=${debugName}`
    );
}

export function getBoxedUiPolicyDebugSnapshot(): BoxedUiCounters {
    return {
        boxedBodyPortalAttempts: counters.boxedBodyPortalAttempts,
        boxedBodyPortalRedirectCount: counters.boxedBodyPortalRedirectCount,
        boxedSurfaceDisabledCount: counters.boxedSurfaceDisabledCount,
    };
}
