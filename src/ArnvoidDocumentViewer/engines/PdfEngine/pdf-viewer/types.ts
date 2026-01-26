export type LoadSource =
  | { type: "url"; value: string }
  | { type: "file"; value: File }
  | { type: "data"; value: ArrayBuffer };

export type RenderPriority = "foreground" | "background";
export type RenderReason = "load" | "page" | "zoom" | "quality";

export type RenderRequest = {
  page: number;
  scale: number;
  dpr: number;
  priority: RenderPriority;
  reason: RenderReason;
};

export type CacheEntry = {
  bitmap: ImageBitmap;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  renderScale: number;
  dpr: number;
  page: number;
};
