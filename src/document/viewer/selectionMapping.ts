/**
 * Selection Mapping - Convert between DOM Selection and global character offsets
 * Relies on data-start/data-end attributes in the DOM
 */

/**
 * Find the nearest ancestor element with data-start attribute
 */
function findSpanAncestor(node: Node): HTMLElement | null {
    let current: Node | null = node;
    while (current && !(current instanceof HTMLElement && current.dataset.start)) {
        current = current.parentNode;
    }
    return current as HTMLElement | null;
}

/**
 * Find the element containing a specific character offset
 */
function findSpanContaining(container: HTMLElement, offset: number): HTMLElement | null {
    const spans = container.querySelectorAll('[data-start]');
    for (const span of spans) {
        const start = parseInt((span as HTMLElement).dataset.start!, 10);
        const end = parseInt((span as HTMLElement).dataset.end!, 10);
        if (offset >= start && offset < end) {
            return span as HTMLElement;
        }
    }
    return null;
}

/**
 * Convert DOM Selection to global character offsets
 */
export function selectionToOffsets(selection: Selection): { start: number; end: number } | null {
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const startSpan = findSpanAncestor(range.startContainer);
    const endSpan = findSpanAncestor(range.endContainer);

    if (!startSpan || !endSpan) return null;

    const startBase = parseInt(startSpan.dataset.start!, 10);
    const endBase = parseInt(endSpan.dataset.start!, 10);

    // Handle text node offsets
    let startOffset = range.startOffset;
    let endOffset = range.endOffset;

    // If the container is an element (not text), we need to adjust
    if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        startOffset = 0;
    }
    if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
        endOffset = 0;
    }

    return {
        start: startBase + startOffset,
        end: endBase + endOffset,
    };
}

/**
 * Convert global character offsets to a DOM Range
 */
export function offsetsToRange(
    container: HTMLElement,
    start: number,
    end: number
): Range | null {
    const startSpan = findSpanContaining(container, start);
    const endSpan = findSpanContaining(container, end);

    if (!startSpan || !endSpan) return null;

    const range = document.createRange();
    const startBase = parseInt(startSpan.dataset.start!, 10);
    const endBase = parseInt(endSpan.dataset.start!, 10);
    const startLocal = start - startBase;
    const endLocal = end - endBase;

    // Find the text node within the span
    const startTextNode = startSpan.firstChild;
    const endTextNode = endSpan.firstChild;

    if (!startTextNode || !endTextNode) return null;

    try {
        range.setStart(startTextNode, Math.max(0, startLocal));
        range.setEnd(endTextNode, Math.max(0, endLocal));
        return range;
    } catch (e) {
        console.error('[Selection] Failed to create range:', e);
        return null;
    }
}
