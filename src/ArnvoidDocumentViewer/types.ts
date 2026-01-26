export type DocumentFormat = "pdf" | "docx" | "md" | "txt";

export type ViewerSource =
  | { kind: "file"; file: File; formatHint?: DocumentFormat }
  | {
      kind: "arrayBuffer";
      buffer: ArrayBuffer;
      fileName?: string;
      mimeType?: string;
      formatHint?: DocumentFormat;
    }
  | {
      kind: "url";
      url: string;
      fileName?: string;
      mimeType?: string;
      formatHint?: DocumentFormat;
    }
  | { kind: "text"; text: string; formatHint?: "md" | "txt" }
  | { kind: "parsed"; text: string; formatHint?: "txt" };
