export const SAMPLE_GRAPH_PREVIEW_ROOT_ATTR = 'data-arnvoid-graph-preview-root';
export const SAMPLE_GRAPH_PREVIEW_ROOT_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_ROOT_ATTR}="${SAMPLE_GRAPH_PREVIEW_ROOT_VALUE}"]`;
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR = 'data-arnvoid-preview-portal-root';
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR}="${SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE}"]`;

function toElement(target: EventTarget | null): Element | null {
    if (!target) return null;
    if (target instanceof Element) return target;
    if (target instanceof Node) return target.parentElement;
    return null;
}

export function isInsideSampleGraphPreviewRoot(target: EventTarget | null): boolean {
    if (typeof window === 'undefined') return false;
    const element = toElement(target);
    if (!element) return false;
    return element.closest(SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR) !== null;
}

export function isInsideSampleGraphPreviewPortalRoot(target: EventTarget | null): boolean {
    if (typeof window === 'undefined') return false;
    const element = toElement(target);
    if (!element) return false;
    return element.closest(SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR) !== null;
}
