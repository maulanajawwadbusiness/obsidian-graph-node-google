import type { MutableRefObject } from "react";
import { useCallback, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import { CACHE_SIZE, MIN_RENDER_SCALE } from "../constants";
import type { CacheEntry, RenderRequest } from "../types";

type UsePdfRenderQueueParams = {
  pdfDocRef: MutableRefObject<PDFDocumentProxy | null>;
  numPages: number;
  buildTextLayer: (page: any, viewport: any, displayRatio: number) => Promise<void>;
  needsTextLayer: (page: number) => boolean;
  onRenderStatusChange: (isRendering: boolean) => void;
  onError: (message: string) => void;
};

export function usePdfRenderQueue({
  pdfDocRef,
  numPages,
  buildTextLayer,
  needsTextLayer,
  onRenderStatusChange,
  onError,
}: UsePdfRenderQueueParams) {
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderRunningRef = useRef(false);
  const pendingRenderRef = useRef<RenderRequest | null>(null);
  const backgroundQueueRef = useRef<RenderRequest[]>([]);
  const zoomDebounceRef = useRef<number | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const baseSizeRef = useRef({ width: 0, height: 0 });
  const renderScaleRef = useRef(MIN_RENDER_SCALE);
  const lastRenderedKeyRef = useRef<string | null>(null);
  const lastRenderedPageRef = useRef<number | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const getFinalDpr = useCallback(() => Math.min(window.devicePixelRatio || 1, 2), []);
  const getRenderScale = useCallback(
    (targetScale: number) => Math.max(targetScale, MIN_RENDER_SCALE),
    []
  );

  const bucketScale = useCallback((value: number) => Math.round(value * 4) / 4, []);
  const bucketDpr = useCallback((value: number) => (value <= 1 ? 1 : 2), []);
  const cacheKey = useCallback(
    (page: number, scale: number, dpr: number) =>
      `${page}:${bucketScale(scale)}:${bucketDpr(dpr)}`,
    [bucketDpr, bucketScale]
  );

  const clearPreviewTransform = useCallback(() => {
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    const content = stageContentRef.current;
    if (content) {
      content.style.transform = "none";
      content.style.transformOrigin = "top left";
    }
  }, []);

  const setStageSize = useCallback((width: number, height: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
  }, []);

  const setStageContentSize = useCallback((width: number, height: number) => {
    const content = stageContentRef.current;
    if (!content) return;
    content.style.width = `${width}px`;
    content.style.height = `${height}px`;
  }, []);

  const swapCanvasLayers = useCallback(
    (nextFront: HTMLCanvasElement, prevFront: HTMLCanvasElement) => {
      nextFront.classList.add("canvas-front");
      nextFront.classList.remove("canvas-back");
      prevFront.classList.remove("canvas-front");
      prevFront.classList.add("canvas-back");
      const nextIsFront = nextFront.classList.contains("canvas-front");
      const prevIsFront = prevFront.classList.contains("canvas-front");
      if (nextIsFront === prevIsFront) {
        console.debug("[pdf-viewer] canvas visibility mismatch after swap", {
          nextIsFront,
          prevIsFront,
        });
      } else {
        console.debug("[pdf-viewer] canvas swap ok");
      }
    },
    []
  );

  const applyPreviewTransform = useCallback(
    (targetScale: number) => {
      const stage = stageRef.current;
      const content = stageContentRef.current;
      const base = baseSizeRef.current;
      const renderScale = renderScaleRef.current;
      if (!stage || !content || !base.width || !base.height || !renderScale) return;
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);

      previewRafRef.current = requestAnimationFrame(() => {
        const ratio = targetScale / renderScale;
        content.style.transformOrigin = "top left";
        content.style.transform = `scale(${ratio})`;
        setStageSize(base.width * ratio, base.height * ratio);
      });
    },
    [setStageSize]
  );

  const touchCache = useCallback(
    (key: string) => {
      const cache = cacheRef.current;
      const entry = cache.get(key);
      if (!entry) return null;
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    },
    []
  );

  const pruneCache = useCallback(() => {
    const cache = cacheRef.current;
    while (cache.size > CACHE_SIZE) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldest = cache.get(oldestKey);
      if (oldest) {
        oldest.bitmap.close();
      }
      cache.delete(oldestKey);
    }
  }, []);

  const setCacheEntry = useCallback(
    (key: string, entry: CacheEntry) => {
      const cache = cacheRef.current;
      const existing = cache.get(key);
      if (existing) {
        existing.bitmap.close();
      }
      cache.set(key, entry);
      pruneCache();
    },
    [pruneCache]
  );

  const clearCache = useCallback(() => {
    const cache = cacheRef.current;
    for (const entry of cache.values()) {
      entry.bitmap.close();
    }
    cache.clear();
  }, []);

  const cancelRender = useCallback(() => {
    const task = renderTaskRef.current;
    if (task) {
      try {
        task.cancel();
      } catch {
        // cancel can throw if already completed; ignore
      }
      renderTaskRef.current = null;
    }
  }, []);

  const clearZoomDebounce = useCallback(() => {
    if (zoomDebounceRef.current) {
      window.clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = null;
    }
  }, []);

  const clearRenderQueue = useCallback(() => {
    pendingRenderRef.current = null;
    backgroundQueueRef.current = [];
    renderRunningRef.current = false;
  }, []);

  const drawCached = useCallback(
    (entry: CacheEntry, targetScale: number) => {
      const frontCanvas = frontCanvasRef.current;
      const backCanvas = backCanvasRef.current;
      const content = stageContentRef.current;
      if (!frontCanvas || !backCanvas || !content) return;
      const ctx = backCanvas.getContext("2d");
      if (!ctx) return;

      backCanvas.style.transform = "none";
      backCanvas.classList.add("canvas-back");
      backCanvas.classList.remove("canvas-front");
      backCanvas.width = entry.pixelWidth;
      backCanvas.height = entry.pixelHeight;
      backCanvas.style.width = `${entry.cssWidth}px`;
      backCanvas.style.height = `${entry.cssHeight}px`;

      ctx.clearRect(0, 0, backCanvas.width, backCanvas.height);
      ctx.drawImage(entry.bitmap, 0, 0, backCanvas.width, backCanvas.height);

      baseSizeRef.current = { width: entry.cssWidth, height: entry.cssHeight };
      renderScaleRef.current = entry.renderScale;
      lastRenderedPageRef.current = entry.page;
      setStageSize(entry.cssWidth, entry.cssHeight);
      setStageContentSize(entry.cssWidth, entry.cssHeight);
      swapCanvasLayers(backCanvas, frontCanvas);
      frontCanvas.style.transform = "none";
      frontCanvasRef.current = backCanvas;
      backCanvasRef.current = frontCanvas;
      applyPreviewTransform(targetScale);
    },
    [applyPreviewTransform, setStageContentSize, setStageSize, swapCanvasLayers]
  );

  const queueBackgroundRender = useCallback((request: RenderRequest) => {
    backgroundQueueRef.current.push(request);
  }, []);

  const requestRender = useCallback(
    (request: RenderRequest) => {
      if (request.priority === "foreground") {
        backgroundQueueRef.current = [];
      }
      pendingRenderRef.current = request;
      cancelRender();
      if (!renderRunningRef.current) {
        void (async () => {
          renderRunningRef.current = true;
          while (pendingRenderRef.current || backgroundQueueRef.current.length) {
            const nextRequest =
              pendingRenderRef.current ?? backgroundQueueRef.current.shift();
            pendingRenderRef.current = null;
            if (!nextRequest) break;
            const doc = pdfDocRef.current;
            if (!doc) break;
            const nextRenderScale = getRenderScale(nextRequest.scale);
            const renderKey = `${nextRequest.page}:${nextRenderScale}:${nextRequest.dpr}`;
            if (
              nextRequest.priority === "foreground" &&
              lastRenderedKeyRef.current === renderKey
            ) {
              const shouldBuild = needsTextLayer(nextRequest.page);
              if (!shouldBuild) {
                continue;
              }
              const page = await doc.getPage(nextRequest.page);
              try {
                const renderScale = getRenderScale(nextRequest.scale);
                const textViewport = page.getViewport({ scale: renderScale });
                await buildTextLayer(page, textViewport, 1);
              } finally {
                page.cleanup();
              }
              continue;
            }
            try {
              if (nextRequest.priority === "foreground") {
                onRenderStatusChange(true);
              }

              if (nextRequest.priority === "background") {
                const offscreen = document.createElement("canvas");
                const page = await doc.getPage(nextRequest.page);
                try {
                  const renderScale = getRenderScale(nextRequest.scale);
                  const viewport = page.getViewport({ scale: renderScale });
                  const cssWidth = viewport.width;
                  const cssHeight = viewport.height;
                  const pixelWidth = Math.ceil(viewport.width * nextRequest.dpr);
                  const pixelHeight = Math.ceil(
                    viewport.height * nextRequest.dpr
                  );
                  offscreen.width = pixelWidth;
                  offscreen.height = pixelHeight;
                  const ctx = offscreen.getContext("2d");
                  if (!ctx) continue;
                  const transform =
                    nextRequest.dpr !== 1
                      ? [nextRequest.dpr, 0, 0, nextRequest.dpr, 0, 0]
                      : undefined;
                  const task = page.render({
                    canvas: offscreen,
                    viewport,
                    transform,
                  });
                  renderTaskRef.current = task;
                  await task.promise;
                  const bitmap = await createImageBitmap(offscreen);
                  const key = cacheKey(
                    nextRequest.page,
                    renderScale,
                    nextRequest.dpr
                  );
                  setCacheEntry(key, {
                    bitmap,
                    cssWidth,
                    cssHeight,
                    pixelWidth,
                    pixelHeight,
                    renderScale,
                    dpr: nextRequest.dpr,
                    page: nextRequest.page,
                  });
                } finally {
                  page.cleanup();
                }
                continue;
              }

              const canvas = backCanvasRef.current;
              const content = stageContentRef.current;
              if (!canvas || !content) continue;

              const page = await doc.getPage(nextRequest.page);
              try {
                const targetScale = nextRequest.scale;
                const renderScale = getRenderScale(targetScale);
                const viewport = page.getViewport({ scale: renderScale });
                const cssWidth = viewport.width;
                const cssHeight = viewport.height;
                const pixelWidth = Math.ceil(viewport.width * nextRequest.dpr);
                const pixelHeight = Math.ceil(
                  viewport.height * nextRequest.dpr
                );

                canvas.style.transform = "none";
                canvas.classList.add("canvas-back");
                canvas.classList.remove("canvas-front");
                if (canvas === frontCanvasRef.current) {
                  console.debug("[pdf-viewer] front canvas resized during render", {
                    page: nextRequest.page,
                    scale: nextRequest.scale,
                  });
                }
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
                canvas.style.width = `${cssWidth}px`;
                canvas.style.height = `${cssHeight}px`;
                setStageSize(cssWidth, cssHeight);
                setStageContentSize(cssWidth, cssHeight);

                const ctx = canvas.getContext("2d");
                if (!ctx) continue;
                const transform =
                  nextRequest.dpr !== 1
                    ? [nextRequest.dpr, 0, 0, nextRequest.dpr, 0, 0]
                    : undefined;
                const task = page.render({ canvas, viewport, transform });
                renderTaskRef.current = task;
                await task.promise;

                const displayRatio = targetScale / renderScale;
                const frontCanvas = frontCanvasRef.current;
                if (frontCanvas) {
                  swapCanvasLayers(canvas, frontCanvas);
                  frontCanvas.style.transform = "none";
                  const content = stageContentRef.current;
                  if (content) {
                    content.style.transformOrigin = "top left";
                    content.style.transform =
                      displayRatio === 1 ? "none" : `scale(${displayRatio})`;
                  }
                  setStageSize(
                    cssWidth * displayRatio,
                    cssHeight * displayRatio
                  );
                  frontCanvasRef.current = canvas;
                  backCanvasRef.current = frontCanvas;
                }

                baseSizeRef.current = { width: cssWidth, height: cssHeight };
                renderScaleRef.current = renderScale;
                lastRenderedKeyRef.current = renderKey;
                lastRenderedPageRef.current = nextRequest.page;

                const textViewport = page.getViewport({ scale: renderScale });
                await buildTextLayer(page, textViewport, displayRatio);

                const bitmap = await createImageBitmap(canvas);
                const key = cacheKey(
                  nextRequest.page,
                  renderScale,
                  nextRequest.dpr
                );
                setCacheEntry(key, {
                  bitmap,
                  cssWidth,
                  cssHeight,
                  pixelWidth,
                  pixelHeight,
                  renderScale,
                  dpr: nextRequest.dpr,
                  page: nextRequest.page,
                });

                if (nextRequest.priority === "foreground") {
                  const prev = nextRequest.page - 1;
                  const next = nextRequest.page + 1;
                  const prerenderScale = nextRequest.scale;
                  const prerenderDpr = nextRequest.dpr;
                  if (prev >= 1) {
                    queueBackgroundRender({
                      page: prev,
                      scale: prerenderScale,
                      dpr: prerenderDpr,
                      priority: "background",
                      reason: "page",
                    });
                  }
                  if (next <= numPages) {
                    queueBackgroundRender({
                      page: next,
                      scale: prerenderScale,
                      dpr: prerenderDpr,
                      priority: "background",
                      reason: "page",
                    });
                  }
                }
              } finally {
                page.cleanup();
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              if (!message.toLowerCase().includes("cancelled")) {
                onError(message);
              }
            } finally {
              renderTaskRef.current = null;
              if (nextRequest.priority === "foreground") {
                onRenderStatusChange(false);
              }
            }
          }
          renderRunningRef.current = false;
        })();
      }
    },
    [
      buildTextLayer,
      cacheKey,
      cancelRender,
      getRenderScale,
      needsTextLayer,
      numPages,
      onError,
      onRenderStatusChange,
      pdfDocRef,
      queueBackgroundRender,
      setCacheEntry,
      setStageSize,
      swapCanvasLayers,
    ]
  );

  const getCachedEntry = useCallback(
    (page: number, scale: number, dpr: number) => {
      const key = cacheKey(page, scale, dpr);
      return touchCache(key);
    },
    [cacheKey, touchCache]
  );

  const resetRenderState = useCallback(() => {
    baseSizeRef.current = { width: 0, height: 0 };
    renderScaleRef.current = MIN_RENDER_SCALE;
    lastRenderedKeyRef.current = null;
    lastRenderedPageRef.current = null;
    if (stageRef.current) {
      stageRef.current.style.width = "0px";
      stageRef.current.style.height = "0px";
    }
    if (stageContentRef.current) {
      stageContentRef.current.style.width = "0px";
      stageContentRef.current.style.height = "0px";
      stageContentRef.current.style.transform = "none";
    }
  }, []);

  return {
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
  };
}
