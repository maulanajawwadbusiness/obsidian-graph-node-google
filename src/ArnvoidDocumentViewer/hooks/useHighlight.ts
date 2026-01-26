import { useCallback, useEffect, useState } from "react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      window.clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useHighlight(
  containerRef: React.RefObject<HTMLElement | null>,
  searchText: string,
  highlightName = "search-match"
) {
  const debouncedSearchText = useDebounce(searchText, 300);

  const highlight = useCallback(() => {
    if (!CSS.highlights) {
      console.warn("CSS Custom Highlight API not supported.");
      return;
    }

    CSS.highlights.delete(highlightName);

    if (!containerRef.current || !debouncedSearchText) {
      return;
    }

    const ranges: Range[] = [];
    const query = debouncedSearchText.toLowerCase();

    const treeWalker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      const textValue = currentNode.textContent?.toLowerCase();

      if (textValue && textValue.includes(query)) {
        let startIndex = 0;
        let index = textValue.indexOf(query, startIndex);

        while (index !== -1) {
          const range = new Range();
          range.setStart(currentNode, index);
          range.setEnd(currentNode, index + query.length);
          ranges.push(range);

          startIndex = index + query.length;
          index = textValue.indexOf(query, startIndex);
        }
      }

      currentNode = treeWalker.nextNode();
    }

    if (ranges.length > 0) {
      const searchHighlight = new Highlight(...ranges);
      CSS.highlights.set(highlightName, searchHighlight);
    }
  }, [debouncedSearchText, containerRef, highlightName]);

  useEffect(() => {
    highlight();
  }, [highlight]);
}
