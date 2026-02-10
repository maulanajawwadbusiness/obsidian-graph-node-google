import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from "pdfjs-dist/types/src/display/api";
import pdfjsLib from "./lib/pdfjs";
import "./pdf-engine.css";
import {
  FINAL_RENDER_DELAY_MS,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_STEP,
} from "./pdf-viewer/constants";
import { PdfCanvasStage } from "./pdf-viewer/components/PdfCanvasStage";
import { PdfToolbar } from "./pdf-viewer/components/PdfToolbar";
import { usePdfRenderQueue } from "./pdf-viewer/hooks/usePdfRenderQueue";
import { usePdfSearch } from "./pdf-viewer/hooks/usePdfSearch";
import type { LoadSource } from "./pdf-viewer/types";

type PdfViewerProps = {
  source: LoadSource | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

const SHOW_TOOLBAR =
  import.meta.env.DEV && import.meta.env.VITE_PDFJS_ENGINE_TOOLBAR === "1";

export default function PdfViewer({ source, scrollContainerRef }: PdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const loadTokenRef = useRef(0);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [isRendering, setIsRendering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const pageNumRef = useRef(pageNum);
  const scaleRef = useRef(scale);

  useEffect(() => {
    pageNumRef.current = pageNum;
  }, [pageNum]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const {
    textLayerRef,
    textLayerStatus,
    textLayerPage,
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
    setSearchEnabled,
  } = usePdfSearch({ pdfDocRef, pageNumRef, scaleRef, setPageNum });

  const {
    frontCanvasRef,
    backCanvasRef,
    stageRef,
    stageContentRef,
    baseSizeRef,
    renderScaleRef,
    lastRenderedPageRef,
    getFinalDpr,
    getRenderScale,
    clearPreviewTransform,
    applyPreviewTransform,
    clearCache,
    clearZoomDebounce,
    clearRenderQueue,
    cancelRender,
    resetRenderState,
    requestRender,
    drawCached,
    getCachedEntry,
  } = usePdfRenderQueue({
    pdfDocRef,
    numPages,
    buildTextLayer,
    needsTextLayer,
    onRenderStatusChange: setIsRendering,
    onError: setError,
  });

  const destroyDoc = useCallback(async () => {
    clearZoomDebounce();
    clearPreviewTransform();
    cancelRender();
    if (loadingTaskRef.current) {
      try {
        await loadingTaskRef.current.destroy();
      } catch {
        // ignore load task teardown errors
      }
      loadingTaskRef.current = null;
    }
    clearCache();
    clearRenderQueue();
    clearTextLayer();
    resetSearchState();
    resetRenderState();
    if (pdfDocRef.current) {
      await pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }
    setPdfDoc(null);
    setNumPages(0);
    setPageNum(1);
  }, [
    cancelRender,
    clearCache,
    clearPreviewTransform,
    clearRenderQueue,
    clearTextLayer,
    clearZoomDebounce,
    resetSearchState,
    resetRenderState,
  ]);

  const loadDocument = useCallback(
    async (loadSource: LoadSource) => {
      const token = ++loadTokenRef.current;
      setError("");
      setIsLoading(true);
      if (loadingTaskRef.current) {
        try {
          await loadingTaskRef.current.destroy();
        } catch {
          // ignore load task teardown errors
        }
        loadingTaskRef.current = null;
      }
      await destroyDoc();

      try {
        const task =
          loadSource.type === "url"
            ? pdfjsLib.getDocument(loadSource.value)
            : loadSource.type === "file"
              ? pdfjsLib.getDocument({
                  data: await loadSource.value.arrayBuffer(),
                })
              : pdfjsLib.getDocument({ data: loadSource.value });
        loadingTaskRef.current = task as PDFDocumentLoadingTask;
        const doc = await task.promise;
        if (token !== loadTokenRef.current) {
          await doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch (err) {
        if (token === loadTokenRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (token === loadTokenRef.current) {
          setIsLoading(false);
        }
      }
    },
    [destroyDoc]
  );

  useEffect(() => {
    return () => {
      void destroyDoc();
    };
  }, [destroyDoc]);

  useEffect(() => {
    setSearchEnabled(SHOW_TOOLBAR);
  }, [setSearchEnabled]);

  useEffect(() => {
    if (!source) {
      void (async () => {
        await destroyDoc();
        setIsLoading(false);
      })();
      return;
    }
    void loadDocument(source);
  }, [destroyDoc, loadDocument, source]);

  useEffect(() => {
    if (!pdfDoc) return;
    clearZoomDebounce();

    clearTextLayer();
    resetHitState();

    const dpr = getFinalDpr();
    const currentScale = scaleRef.current;
    const renderScale = getRenderScale(currentScale);
    const cached = getCachedEntry(pageNum, renderScale, dpr);
    if (cached) {
      drawCached(cached, currentScale);
    }
    requestRender({
      page: pageNum,
      scale: currentScale,
      dpr,
      priority: "foreground",
      reason: "page",
    });
  }, [
    pdfDoc,
    pageNum,
    clearZoomDebounce,
    clearTextLayer,
    resetHitState,
    drawCached,
    getCachedEntry,
    getFinalDpr,
    getRenderScale,
    requestRender,
  ]);

  useEffect(() => {
    if (!pdfDoc) return;
    const currentPage = pageNumRef.current;
    if (
      lastRenderedPageRef.current !== currentPage ||
      !baseSizeRef.current.width
    ) {
      requestRender({
        page: currentPage,
        scale,
        dpr: getFinalDpr(),
        priority: "foreground",
        reason: "load",
      });
      return;
    }

    const currentRenderScale = renderScaleRef.current;
    const nextRenderScale = getRenderScale(scale);

    applyPreviewTransform(scale);
    if (nextRenderScale === currentRenderScale) {
      clearZoomDebounce();
      return;
    }

    clearZoomDebounce();
    const timeout = window.setTimeout(() => {
      requestRender({
        page: currentPage,
        scale,
        dpr: getFinalDpr(),
        priority: "foreground",
        reason: "zoom",
      });
    }, FINAL_RENDER_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    pdfDoc,
    scale,
    applyPreviewTransform,
    clearZoomDebounce,
    getFinalDpr,
    getRenderScale,
    requestRender,
    baseSizeRef,
    lastRenderedPageRef,
    renderScaleRef,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const root = viewerRef.current;
      if (!root) return;
      const active = document.activeElement;
      if (!active || !root.contains(active)) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPageNum((p) => Math.max(1, p - 1));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPageNum((p) => Math.min(numPages || 1, p + 1));
      }
    },
    [numPages]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  return (
    <div
      className="pdf-engine viewer"
      ref={viewerRef}
      tabIndex={0}
      onPointerDown={() => {
        viewerRef.current?.focus({ preventScroll: true });
      }}
    >
      {SHOW_TOOLBAR && (
        <PdfToolbar
          pageNum={pageNum}
          numPages={numPages}
          scale={scale}
          isRendering={isRendering}
          searchQuery={searchQuery}
          totalHits={totalHits}
          currentHitIndex={currentHitIndex}
          textLayerStatus={textLayerStatus}
          textLayerPage={textLayerPage}
          onPrevPage={() => setPageNum((p) => Math.max(1, p - 1))}
          onNextPage={() => setPageNum((p) => Math.min(numPages || 1, p + 1))}
          onZoomOut={() =>
            setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))
          }
          onZoomIn={() =>
            setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))
          }
          onSearchChange={handleSearchChange}
          onPrevHit={goToPrevHit}
          onNextHit={goToNextHit}
        />
      )}

      {error && <div className="error">{error}</div>}

      <PdfCanvasStage
        stageRef={stageRef}
        stageContentRef={stageContentRef}
        frontCanvasRef={frontCanvasRef}
        backCanvasRef={backCanvasRef}
        textLayerRef={textLayerRef}
        scrollContainerRef={scrollContainerRef}
      />

      <div className="page-nav">
        <span className="page-label">
          Page {pageNum} / {numPages || 1}
        </span>
        <div className="page-controls">
          <button
            type="button"
            className="page-btn"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1 || isRendering || isLoading}
            aria-label="Previous page"
          >
            ^
          </button>
          <button
            type="button"
            className="page-btn"
            onClick={() => setPageNum((p) => Math.min(numPages || 1, p + 1))}
            disabled={pageNum >= (numPages || 1) || isRendering || isLoading}
            aria-label="Next page"
          >
            v
          </button>
        </div>
      </div>
    </div>
  );
}
