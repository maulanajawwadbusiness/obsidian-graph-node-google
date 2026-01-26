export type ArnvoidDocumentViewerAdapter = {
  scrollToPosition: (charOffset: number) => void;
  highlightRange: (start: number, end: number) => void;
  clearHighlight: () => void;
  getCurrentPosition: () => number;
  isVisible: () => boolean;
};
