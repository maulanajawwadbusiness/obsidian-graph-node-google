export function createRangeFromOffsets(
  root: HTMLElement,
  start: number,
  end: number
): Range | null {
  if (start < 0 || end <= start) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let currentNode = walker.nextNode() as Text | null;
  let offset = 0;

  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;

  while (currentNode) {
    const textLength = currentNode.textContent?.length ?? 0;
    const nodeStart = offset;
    const nodeEnd = offset + textLength;

    if (!startNode && start >= nodeStart && start <= nodeEnd) {
      startNode = currentNode;
      startOffset = Math.max(0, start - nodeStart);
    }

    if (!endNode && end >= nodeStart && end <= nodeEnd) {
      endNode = currentNode;
      endOffset = Math.max(0, end - nodeStart);
    }

    if (startNode && endNode) break;

    offset += textLength;
    currentNode = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function getOffsetForNode(root: HTMLElement, node: Text): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let currentNode = walker.nextNode() as Text | null;
  let offset = 0;

  while (currentNode) {
    if (currentNode === node) {
      return offset;
    }
    offset += currentNode.textContent?.length ?? 0;
    currentNode = walker.nextNode() as Text | null;
  }

  return offset;
}
