import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { renderAsync } from "docx-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "github-markdown-css/github-markdown-light.css";
import type { ArnvoidDocumentViewerAdapter } from "./adapter";
import type { DocumentFormat, ViewerSource } from "./types";
import { useHighlight } from "./hooks/useHighlight";
import { createRangeFromOffsets } from "./hooks/textRange";
import PdfViewer from "./engines/PdfEngine/PdfViewer";
import type { LoadSource } from "./engines/PdfEngine/pdf-viewer/types";
import "./styles.css";

export type ArnvoidDocumentViewerProps = {
  source: ViewerSource | null;
  searchText?: string;
  className?: string;
  style?: CSSProperties;
  onError?: (message: string) => void;
};

function getFormatFromName(name?: string): DocumentFormat | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

function getFormatFromMime(mimeType?: string): DocumentFormat | null {
  if (!mimeType) return null;
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (mimeType === "text/markdown") return "md";
  if (mimeType === "text/plain") return "txt";
  return null;
}

function inferFormat(source: ViewerSource | null): DocumentFormat | null {
  if (!source) return null;
  if (source.kind === "file") {
    return source.formatHint ?? getFormatFromName(source.file.name);
  }
  if (source.kind === "arrayBuffer") {
    return (
      source.formatHint ??
      getFormatFromName(source.fileName) ??
      getFormatFromMime(source.mimeType)
    );
  }
  if (source.kind === "url") {
    return (
      source.formatHint ??
      getFormatFromName(source.fileName ?? source.url) ??
      getFormatFromMime(source.mimeType)
    );
  }
  if (source.kind === "text") {
    return source.formatHint ?? "txt";
  }
  if (source.kind === "parsed") {
    return source.formatHint ?? "txt";
  }
  return null;
}

export const ArnvoidDocumentViewer = forwardRef<
  ArnvoidDocumentViewerAdapter,
  ArnvoidDocumentViewerProps
>(function ArnvoidDocumentViewer(
  { source, searchText = "", className, style, onError },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const lastKnownPositionRef = useRef(0);

  const [format, setFormat] = useState<DocumentFormat | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfSource, setPdfSource] = useState<LoadSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  useHighlight(containerRef, searchText, "search-match");

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  useEffect(() => {
    let cancelled = false;
    const nextFormat = inferFormat(source);
    setFormat(nextFormat);
    setTextContent(null);
    setDocxBuffer(null);
    setPdfSource(null);
    setError(null);

    if (!source || !nextFormat) return;

    const resolve = async () => {
      try {
        if (nextFormat === "pdf") {
          if (source.kind === "file") {
            if (!cancelled) setPdfSource({ type: "file", value: source.file });
            return;
          }
          if (source.kind === "arrayBuffer") {
            if (!cancelled)
              setPdfSource({ type: "data", value: source.buffer });
            return;
          }
          if (source.kind === "url") {
            if (!cancelled) setPdfSource({ type: "url", value: source.url });
            return;
          }
          reportError("Unsupported PDF source.");
          return;
        }

        if (nextFormat === "docx") {
          if (source.kind === "file") {
            const buffer = await source.file.arrayBuffer();
            if (!cancelled) setDocxBuffer(buffer);
            return;
          }
          if (source.kind === "arrayBuffer") {
            if (!cancelled) setDocxBuffer(source.buffer);
            return;
          }
          if (source.kind === "url") {
            const response = await fetch(source.url);
            if (!response.ok) {
              reportError(`Failed to fetch DOCX (${response.status}).`);
              return;
            }
            const buffer = await response.arrayBuffer();
            if (!cancelled) setDocxBuffer(buffer);
            return;
          }
          reportError("Unsupported DOCX source.");
          return;
        }

        if (nextFormat === "md" || nextFormat === "txt") {
          if (source.kind === "text" || source.kind === "parsed") {
            if (!cancelled) setTextContent(source.text);
            return;
          }
          if (source.kind === "file") {
            const text = await source.file.text();
            if (!cancelled) setTextContent(text);
            return;
          }
          if (source.kind === "arrayBuffer") {
            const decoder = new TextDecoder("utf-8");
            if (!cancelled) setTextContent(decoder.decode(source.buffer));
            return;
          }
          if (source.kind === "url") {
            const response = await fetch(source.url);
            if (!response.ok) {
              reportError(`Failed to fetch text (${response.status}).`);
              return;
            }
            const text = await response.text();
            if (!cancelled) setTextContent(text);
            return;
          }
        }
      } catch (err) {
        if (!cancelled) {
          reportError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [source, reportError]);

  useEffect(() => {
    if (format !== "docx" || !docxBuffer || !docxContainerRef.current) return;
    docxContainerRef.current.innerHTML = "";
    renderAsync(docxBuffer, docxContainerRef.current).catch((err) =>
      reportError(err instanceof Error ? err.message : String(err))
    );
  }, [format, docxBuffer, reportError]);

  const getScrollContainer = useCallback(() => {
    return (
      scrollContainerRef.current ??
      (containerRef.current?.querySelector(
        "[data-arnvoid-scroll]"
      ) as HTMLDivElement | null)
    );
  }, []);

  const scrollToPosition = useCallback((charOffset: number) => {
    if (!containerRef.current) return;
    const clampedStart = Math.max(0, charOffset);
    const range = createRangeFromOffsets(
      containerRef.current,
      clampedStart,
      clampedStart + 1
    );
    if (!range) return;
    lastKnownPositionRef.current = clampedStart;
    const element = range.startContainer.parentElement;
    if (element) {
      element.scrollIntoView({ block: "center" });
    }
  }, []);

  const highlightRange = useCallback((start: number, end: number) => {
    if (!CSS.highlights) return;
    if (!containerRef.current) return;
    const range = createRangeFromOffsets(containerRef.current, start, end);
    if (!range) return;
    const highlight = new Highlight(range);
    CSS.highlights.set("arnvoid-range", highlight);
    lastKnownPositionRef.current = start;
  }, []);

  const clearHighlight = useCallback(() => {
    if (!CSS.highlights) return;
    CSS.highlights.delete("arnvoid-range");
  }, []);

  const getCurrentPosition = useCallback(() => {
    const root = containerRef.current;
    const scroller = getScrollContainer();
    if (!root || !scroller) return lastKnownPositionRef.current;
    const scrollerRect = scroller.getBoundingClientRect();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentNode = walker.nextNode() as Text | null;
    let offset = 0;

    while (currentNode) {
      const textLength = currentNode.textContent?.length ?? 0;
      if (textLength > 0) {
        const range = document.createRange();
        range.selectNodeContents(currentNode);
        const rect = range.getBoundingClientRect();
        if (rect.bottom >= scrollerRect.top && rect.top <= scrollerRect.bottom) {
          const candidate = offset;
          lastKnownPositionRef.current = candidate;
          return candidate;
        }
      }
      offset += textLength;
      currentNode = walker.nextNode() as Text | null;
    }

    return lastKnownPositionRef.current;
  }, [getScrollContainer]);

  const isVisible = useCallback(() => {
    return !!containerRef.current && containerRef.current.getClientRects().length > 0;
  }, []);

  const adapter = useMemo(
    () => ({
      scrollToPosition,
      highlightRange,
      clearHighlight,
      getCurrentPosition,
      isVisible,
    }),
    [scrollToPosition, highlightRange, clearHighlight, getCurrentPosition, isVisible]
  );

  useImperativeHandle(ref, () => adapter, [adapter]);

  useEffect(() => {
    if (!source) {
      clearHighlight();
    }
  }, [source, clearHighlight]);

  return (
    <div className={`arnvoid-viewer ${className ?? ""}`} style={style}>
      <div className="arnvoid-viewer-body" ref={containerRef}>
        {format === "pdf" ? (
          <PdfViewer source={pdfSource} scrollContainerRef={scrollContainerRef} />
        ) : (
          <div
            className="arnvoid-viewer-scroll"
            ref={scrollContainerRef}
            data-arnvoid-scroll
          >
            {error && <div className="arnvoid-error">{error}</div>}
            {format === "md" && typeof textContent === "string" && (
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            )}
            {format === "txt" && typeof textContent === "string" && (
              <pre className="arnvoid-text">{textContent}</pre>
            )}
            {format === "docx" && <div ref={docxContainerRef} />}
            {!source && (
              <div className="arnvoid-empty">No document loaded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
