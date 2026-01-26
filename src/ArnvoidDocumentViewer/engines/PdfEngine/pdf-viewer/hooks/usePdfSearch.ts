import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import pdfjsLib from "../../lib/pdfjs";

function escapeHtml(value: string): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type UsePdfSearchParams = {
  pdfDocRef: MutableRefObject<PDFDocumentProxy | null>;
  pageNumRef: MutableRefObject<number>;
  scaleRef: MutableRefObject<number>;
  setPageNum: Dispatch<SetStateAction<number>>;
};

type SearchStatus = "idle" | "building" | "ready" | "error";

type SearchResult = { page: number; count: number };

type TextLayerInstance = { cancel?: () => void };

type TextLayerToken = { cancelled: boolean; page: number };

export function usePdfSearch({
  pdfDocRef,
  pageNumRef,
  scaleRef,
  setPageNum,
}: UsePdfSearchParams) {
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const textLayerInstanceRef = useRef<TextLayerInstance | null>(null);
  const textLayerTokenRef = useRef<TextLayerToken>({
    cancelled: false,
    page: -1,
  });
  const textLayerPageRef = useRef<number | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const searchQueryRef = useRef("");
  const searchEnabledRef = useRef(true);
  const hitSpansRef = useRef<HTMLSpanElement[]>([]);
  const currentHitIndexRef = useRef(-1);
  const searchResultsRef = useRef<SearchResult[]>([]);
  const scanTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const pendingHitNavRef = useRef<"next" | "prev" | null>(null);
  const pageTextCacheRef = useRef<Map<number, string>>(new Map());

  const [searchQuery, setSearchQuery] = useState("");
  const [totalHits, setTotalHits] = useState(0);
  const [currentHitIndex, setCurrentHitIndex] = useState(-1);
  const [textLayerStatus, setTextLayerStatus] = useState<SearchStatus>("idle");
  const [textLayerPage, setTextLayerPage] = useState<number | null>(null);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const clearTextLayer = useCallback(() => {
    if (textLayerTokenRef.current) {
      textLayerTokenRef.current.cancelled = true;
    }
    if (textLayerInstanceRef.current?.cancel) {
      textLayerInstanceRef.current.cancel();
    }
    textLayerInstanceRef.current = null;
    textLayerPageRef.current = null;
    setTextLayerPage(null);
    setTextLayerStatus("idle");
    const container = textLayerRef.current;
    if (container) {
      container.innerHTML = "";
      container.style.transform = "none";
    }
  }, []);

  const resetSearchState = useCallback(() => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    scanTokenRef.current.cancelled = true;
    searchResultsRef.current = [];
    hitSpansRef.current = [];
    pageTextCacheRef.current.clear();
    pendingHitNavRef.current = null;
    setTotalHits(0);
    setCurrentHitIndex(-1);
    currentHitIndexRef.current = -1;
    setSearchQuery("");
  }, []);

  const resetHitState = useCallback(() => {
    hitSpansRef.current = [];
    setTotalHits(0);
    setCurrentHitIndex(-1);
    currentHitIndexRef.current = -1;
  }, []);

  const findNextResultPage = useCallback(
    (direction: "next" | "prev") => {
      const results = searchResultsRef.current;
      if (!results.length) return null;
      const pages = results.map((item) => item.page).sort((a, b) => a - b);
      const current = pageNumRef.current;
      if (direction === "next") {
        const next = pages.find((page) => page > current);
        return next ?? pages[0] ?? null;
      }
      const prev = [...pages].reverse().find((page) => page < current);
      return prev ?? pages[pages.length - 1] ?? null;
    },
    [pageNumRef]
  );

  const highlightSearchResults = useCallback(
    (query: string, initialIndex?: number) => {
      const container = textLayerRef.current;
      if (!container) {
        hitSpansRef.current = [];
        setTotalHits(0);
        setCurrentHitIndex(-1);
        currentHitIndexRef.current = -1;
        return;
      }
      if (!searchEnabledRef.current && query.trim()) {
        hitSpansRef.current = [];
        setTotalHits(0);
        setCurrentHitIndex(-1);
        currentHitIndexRef.current = -1;
        return;
      }

      const spans = Array.from(
        container.querySelectorAll<HTMLSpanElement>(":scope > span")
      );
      const resolvedSpans =
        spans.length > 0
          ? spans
          : Array.from(container.querySelectorAll<HTMLSpanElement>("span"));
      if (spans.length === 0) {
        console.debug("[pdf-viewer] highlight fallback spans", {
          page: pageNumRef.current,
          count: resolvedSpans.length,
        });
      }
      const trimmed = query.trim();
      container
        .querySelectorAll<HTMLSpanElement>(".pdf-hit.current")
        .forEach((hit) => hit.classList.remove("current"));

      if (!trimmed) {
        hitSpansRef.current = [];
        setTotalHits(0);
        setCurrentHitIndex(-1);
        currentHitIndexRef.current = -1;
        resolvedSpans.forEach((span) => {
          if (span.dataset.hl === "1" && span.dataset.orig !== undefined) {
            span.textContent = span.dataset.orig;
            span.dataset.hl = "0";
          }
          span.classList.remove("highlight", "current");
        });
        return;
      }

      const regex = new RegExp(escapeRegExp(trimmed), "gi");
      const hits: HTMLSpanElement[] = [];
      for (const span of resolvedSpans) {
        if (span.dataset.orig === undefined) {
          span.dataset.orig = span.textContent ?? "";
        }
        const originalText = span.dataset.orig;
        regex.lastIndex = 0;
        const hasMatch = regex.test(originalText);
        if (!hasMatch) {
          if (span.dataset.hl === "1") {
            span.textContent = originalText;
            span.dataset.hl = "0";
          }
          span.classList.remove("highlight", "current");
          continue;
        }

        let newHtml = "";
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((match = regex.exec(originalText)) !== null) {
          newHtml += escapeHtml(originalText.substring(lastIndex, match.index));
          newHtml += `<span class="pdf-hit">${escapeHtml(match[0])}</span>`;
          lastIndex = regex.lastIndex;
        }
        newHtml += escapeHtml(originalText.substring(lastIndex));
        span.innerHTML = newHtml;
        span.dataset.hl = "1";
        span.classList.add("highlight");
        span
          .querySelectorAll<HTMLSpanElement>(".pdf-hit")
          .forEach((hit) => hits.push(hit));
      }

      hitSpansRef.current = hits;
      setTotalHits(hits.length);
      console.debug("[pdf-viewer] highlight results", {
        page: pageNumRef.current,
        spanCount: resolvedSpans.length,
        hitCount: hits.length,
      });
      if (!hits.length) {
        setCurrentHitIndex(-1);
        currentHitIndexRef.current = -1;
        return;
      }

      let nextIndex = 0;
      if (typeof initialIndex === "number") {
        if (initialIndex === Number.POSITIVE_INFINITY) {
          nextIndex = hits.length - 1;
        } else {
          nextIndex = Math.min(Math.max(initialIndex, 0), hits.length - 1);
        }
      }

      setCurrentHitIndex(nextIndex);
      currentHitIndexRef.current = nextIndex;
      hits[nextIndex].classList.add("current");
      hits[nextIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    },
    []
  );

  const buildTextLayer = useCallback(
    async (page: any, viewport: any, _displayRatio: number) => {
      const container = textLayerRef.current;
      if (!container) return;

      const currentPage = pageNumRef.current;
      textLayerTokenRef.current.cancelled = true;
      const token = { cancelled: false, page: currentPage };
      textLayerTokenRef.current = token;

      if (textLayerInstanceRef.current?.cancel) {
        textLayerInstanceRef.current.cancel();
      }
      textLayerInstanceRef.current = null;
      container.innerHTML = "";
      container.style.left = "0";
      container.style.top = "0";
      container.style.right = "0";
      container.style.bottom = "0";
      container.style.transformOrigin = "0 0";
      container.style.transform = "none";

      try {
        setTextLayerStatus("building");
        const textContentSource = page.streamTextContent({
          normalizeWhitespace: true,
        });
        const textLayerViewport = viewport ?? page.getViewport({ scale: scaleRef.current });
        container.style.width = `${textLayerViewport.width}px`;
        container.style.height = `${textLayerViewport.height}px`;
        container.style.setProperty(
          "--scale-factor",
          String(textLayerViewport.scale)
        );
        const textLayer = new (pdfjsLib as any).TextLayer({
          textContentSource,
          container,
          viewport: textLayerViewport,
        });
        textLayerInstanceRef.current = textLayer;
        await textLayer.render();

        if (token.cancelled || pageNumRef.current !== currentPage) return;
        setTextLayerStatus("ready");
        textLayerPageRef.current = currentPage;
        setTextLayerPage(currentPage);

        if (searchEnabledRef.current) {
          const pendingNav = pendingHitNavRef.current;
          pendingHitNavRef.current = null;
          if (searchQueryRef.current.trim()) {
            const initialIndex =
              pendingNav === "prev"
                ? Number.POSITIVE_INFINITY
                : pendingNav === "next"
                  ? 0
                  : undefined;
            highlightSearchResults(searchQueryRef.current, initialIndex);
          } else {
            hitSpansRef.current = [];
            setTotalHits(0);
            setCurrentHitIndex(-1);
            currentHitIndexRef.current = -1;
          }
        }

        if (
          searchEnabledRef.current &&
          !pageTextCacheRef.current.has(currentPage)
        ) {
          const textContent = await page.getTextContent({
            normalizeWhitespace: true,
          });
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          pageTextCacheRef.current.set(currentPage, pageText);
        }
      } catch (err) {
        if (
          !(
            err instanceof Error && err.message.toLowerCase().includes("cancel")
          )
        ) {
          console.warn("[pdf-viewer] text layer error:", err);
          setTextLayerStatus("error");
        }
      }
    },
    [highlightSearchResults, pageNumRef, scaleRef]
  );

  const scheduleIdle = useCallback((fn: () => void) => {
    const globalScope = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (typeof globalScope.requestIdleCallback === "function") {
      globalScope.requestIdleCallback(fn);
    } else {
      globalThis.setTimeout(fn, 0);
    }
  }, []);

  const scanDocumentForQuery = useCallback(
    async (query: string) => {
      const doc = pdfDocRef.current;
      if (!doc) return;
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) return;

      scanTokenRef.current.cancelled = true;
      const token = { cancelled: false };
      scanTokenRef.current = token;
      const results: SearchResult[] = [];

      const countMatches = (text: string, q: string) => {
        if (!q) return 0;
        let count = 0;
        let index = 0;
        while (true) {
          const nextIndex = text.indexOf(q, index);
          if (nextIndex === -1) break;
          count += 1;
          index = nextIndex + q.length;
        }
        return count;
      };

      const scanPage = async (page: number) => {
        if (token.cancelled) return;
        if (page > doc.numPages) {
          if (!token.cancelled) {
            searchResultsRef.current = results;
          }
          return;
        }

        let text = pageTextCacheRef.current.get(page);
        if (!text) {
          try {
            const pdfPage = await doc.getPage(page);
            try {
              const content = await pdfPage.getTextContent();
              text = content.items.map((item: any) => item.str).join(" ");
              pageTextCacheRef.current.set(page, text);
            } finally {
              pdfPage.cleanup();
            }
          } catch {
            text = "";
          }
        }

        const matches = countMatches(text.toLowerCase(), trimmed);
        if (matches > 0) {
          results.push({ page, count: matches });
        }

        scheduleIdle(() => {
          void scanPage(page + 1);
        });
      };

      void scanPage(1);
    },
    [pdfDocRef, scheduleIdle]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      if (!searchEnabledRef.current) {
        return;
      }
      setSearchQuery(query);
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }

      if (!query.trim()) {
        scanTokenRef.current.cancelled = true;
        searchResultsRef.current = [];
        highlightSearchResults("");
        return;
      }

      searchResultsRef.current = [];
      searchDebounceRef.current = window.setTimeout(() => {
        highlightSearchResults(query);
        void scanDocumentForQuery(query);
      }, 150);
    },
    [highlightSearchResults, scanDocumentForQuery]
  );

  const goToNextHit = useCallback(() => {
    if (!searchEnabledRef.current) {
      return;
    }
    let hits = hitSpansRef.current;
    if (!hits.length && searchQueryRef.current.trim()) {
      highlightSearchResults(searchQueryRef.current);
      hits = hitSpansRef.current;
    }
    if (!hits.length) {
      const nextPage = findNextResultPage("next");
      if (nextPage && nextPage !== pageNumRef.current) {
        pendingHitNavRef.current = "next";
        setPageNum(nextPage);
      }
      return;
    }

    if (totalHits !== hits.length) {
      setTotalHits(hits.length);
    }

    let currentIndex = currentHitIndexRef.current;
    if (currentIndex < 0 || currentIndex >= hits.length) {
      hits.forEach((span) => span.classList.remove("current"));
      const normalizedIndex = 0;
      currentHitIndexRef.current = normalizedIndex;
      setCurrentHitIndex(normalizedIndex);
      hits[normalizedIndex].classList.add("current");
      hits[normalizedIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    if (currentIndex < hits.length - 1) {
      hits[currentIndex]?.classList.remove("current");
      const nextIndex = currentIndex + 1;
      currentHitIndexRef.current = nextIndex;
      setCurrentHitIndex(nextIndex);
      hits[nextIndex].classList.add("current");
      hits[nextIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const nextPage = findNextResultPage("next");
    if (nextPage && nextPage !== pageNumRef.current) {
      pendingHitNavRef.current = "next";
      setPageNum(nextPage);
      return;
    }

    hits[currentIndex]?.classList.remove("current");
    const nextIndex = 0;
    currentHitIndexRef.current = nextIndex;
    setCurrentHitIndex(nextIndex);
    hits[nextIndex].classList.add("current");
    hits[nextIndex].scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    findNextResultPage,
    highlightSearchResults,
    pageNumRef,
    setPageNum,
    totalHits,
  ]);

  const goToPrevHit = useCallback(() => {
    if (!searchEnabledRef.current) {
      return;
    }
    let hits = hitSpansRef.current;
    if (!hits.length && searchQueryRef.current.trim()) {
      highlightSearchResults(searchQueryRef.current);
      hits = hitSpansRef.current;
    }
    if (!hits.length) {
      const prevPage = findNextResultPage("prev");
      if (prevPage && prevPage !== pageNumRef.current) {
        pendingHitNavRef.current = "prev";
        setPageNum(prevPage);
      }
      return;
    }

    if (totalHits !== hits.length) {
      setTotalHits(hits.length);
    }

    let currentIndex = currentHitIndexRef.current;
    if (currentIndex < 0 || currentIndex >= hits.length) {
      hits.forEach((span) => span.classList.remove("current"));
      const normalizedIndex = hits.length - 1;
      currentHitIndexRef.current = normalizedIndex;
      setCurrentHitIndex(normalizedIndex);
      hits[normalizedIndex].classList.add("current");
      hits[normalizedIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    if (currentIndex > 0) {
      hits[currentIndex]?.classList.remove("current");
      const prevIndex = currentIndex - 1;
      currentHitIndexRef.current = prevIndex;
      setCurrentHitIndex(prevIndex);
      hits[prevIndex].classList.add("current");
      hits[prevIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const prevPage = findNextResultPage("prev");
    if (prevPage && prevPage !== pageNumRef.current) {
      pendingHitNavRef.current = "prev";
      setPageNum(prevPage);
      return;
    }

    hits[currentIndex]?.classList.remove("current");
    const prevIndex = hits.length - 1;
    currentHitIndexRef.current = prevIndex;
    setCurrentHitIndex(prevIndex);
    hits[prevIndex].classList.add("current");
    hits[prevIndex].scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    findNextResultPage,
    highlightSearchResults,
    pageNumRef,
    setPageNum,
    totalHits,
  ]);

  const needsTextLayer = useCallback(
    (page: number) =>
      textLayerPageRef.current !== page ||
      !textLayerRef.current?.children.length,
    []
  );

  const setSearchEnabled = useCallback(
    (enabled: boolean) => {
      searchEnabledRef.current = enabled;
      if (!enabled) {
        highlightSearchResults("");
        resetHitState();
        setSearchQuery("");
      }
    },
    [highlightSearchResults, resetHitState]
  );

  return {
    textLayerRef,
    textLayerStatus,
    searchQuery,
    totalHits,
    currentHitIndex,
    handleSearchChange,
    goToNextHit,
    goToPrevHit,
    clearTextLayer,
    resetSearchState,
    resetHitState,
    buildTextLayer,
    needsTextLayer,
    textLayerPage,
    setSearchEnabled,
  };
}
