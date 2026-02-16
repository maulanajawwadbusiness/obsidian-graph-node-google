export const SAMPLE_GRAPH_PREVIEW_ROOT_ATTR = 'data-arnvoid-graph-preview-root';
export const SAMPLE_GRAPH_PREVIEW_ROOT_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_ROOT_ATTR}="${SAMPLE_GRAPH_PREVIEW_ROOT_VALUE}"]`;
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR = 'data-arnvoid-preview-portal-root';
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR}="${SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE}"]`;
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_ATTR = 'data-arnvoid-overlay-interactive';
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_ATTR}="${SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_VALUE}"]`;
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_ATTR = 'data-arnvoid-overlay-scrollable';
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_VALUE = '1';
export const SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_SELECTOR =
    `[${SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_ATTR}="${SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_VALUE}"]`;

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

export function isInsideSampleGraphPreviewOverlayInteractiveRoot(target: EventTarget | null): boolean {
    if (typeof window === 'undefined') return false;
    const element = toElement(target);
    if (!element) return false;
    return element.closest(SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_SELECTOR) !== null;
}

function hasScrollableOverflow(value: string): boolean {
    return value === 'auto' || value === 'scroll' || value === 'overlay';
}

function isVerticallyScrollable(el: HTMLElement, style: CSSStyleDeclaration): boolean {
    if (!hasScrollableOverflow(style.overflowY)) return false;
    return el.scrollHeight > el.clientHeight + 1;
}

function isHorizontallyScrollable(el: HTMLElement, style: CSSStyleDeclaration): boolean {
    if (!hasScrollableOverflow(style.overflowX)) return false;
    return el.scrollWidth > el.clientWidth + 1;
}

function canConsumeVertical(el: HTMLElement, deltaY: number): boolean {
    if (deltaY > 0) {
        return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    }
    if (deltaY < 0) {
        return el.scrollTop > 0;
    }
    return false;
}

function canConsumeHorizontal(el: HTMLElement, deltaX: number): boolean {
    if (deltaX > 0) {
        return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    }
    if (deltaX < 0) {
        return el.scrollLeft > 0;
    }
    return false;
}

function isExplicitScrollableCandidate(el: HTMLElement): boolean {
    return (
        el.getAttribute(SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_ATTR) ===
        SAMPLE_GRAPH_PREVIEW_OVERLAY_SCROLLABLE_VALUE
    );
}

export function findClosestOverlayInteractiveRoot(target: EventTarget | null): HTMLElement | null {
    if (typeof window === 'undefined') return null;
    const element = toElement(target);
    if (!element) return null;
    const root = element.closest(SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_SELECTOR);
    return root instanceof HTMLElement ? root : null;
}

export function findScrollableWheelConsumer(args: {
    target: EventTarget | null;
    overlayRoot: HTMLElement;
    deltaX: number;
    deltaY: number;
}): HTMLElement | null {
    if (typeof window === 'undefined') return null;
    const { target, overlayRoot, deltaX, deltaY } = args;
    const startEl = toElement(target);
    if (!(startEl instanceof HTMLElement)) return null;
    if (!overlayRoot.contains(startEl)) return null;
    if (deltaX === 0 && deltaY === 0) return null;

    let current: HTMLElement | null = startEl;
    while (current) {
        const explicitScrollable = isExplicitScrollableCandidate(current);
        let canConsume = false;
        if (explicitScrollable) {
            const verticalScrollable = current.scrollHeight > current.clientHeight + 1;
            const horizontalScrollable = current.scrollWidth > current.clientWidth + 1;
            canConsume =
                (verticalScrollable && canConsumeVertical(current, deltaY)) ||
                (horizontalScrollable && canConsumeHorizontal(current, deltaX));
        } else {
            const style = window.getComputedStyle(current);
            const verticalScrollable = isVerticallyScrollable(current, style);
            const horizontalScrollable = isHorizontallyScrollable(current, style);
            canConsume =
                (verticalScrollable && canConsumeVertical(current, deltaY)) ||
                (horizontalScrollable && canConsumeHorizontal(current, deltaX));
        }
        if (canConsume) {
            return current;
        }
        if (current === overlayRoot) break;
        const next: Element | null = current.parentElement;
        current = next instanceof HTMLElement ? next : null;
    }
    return null;
}

export function shouldAllowOverlayWheelDefault(args: {
    target: EventTarget | null;
    deltaX: number;
    deltaY: number;
}): boolean {
    const overlayRoot = findClosestOverlayInteractiveRoot(args.target);
    if (!overlayRoot) return false;
    const consumer = findScrollableWheelConsumer({
        target: args.target,
        overlayRoot,
        deltaX: args.deltaX,
        deltaY: args.deltaY,
    });
    return Boolean(consumer);
}
