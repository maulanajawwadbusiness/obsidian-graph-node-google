export const SAMPLE_GRAPH_PREVIEW_ROOT_ATTR = 'data-arnvoid-graph-preview-root';
export const SAMPLE_GRAPH_PREVIEW_ROOT_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_ROOT_ATTR}="${SAMPLE_GRAPH_PREVIEW_ROOT_VALUE}"]`;

export function isInsideSampleGraphPreviewRoot(target: EventTarget | null): boolean {
    if (!target || typeof window === 'undefined') return false;
    if (!(target instanceof Element)) return false;
    return target.closest(SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR) !== null;
}
