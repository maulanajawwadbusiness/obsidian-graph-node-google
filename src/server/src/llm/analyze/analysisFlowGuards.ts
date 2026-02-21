type PendingTextPayload = {
  kind: "text";
  createdAt: number;
  text: string;
};

type PendingFilePayload = {
  kind: "file";
  createdAt: number;
  file: {
    name: string;
    size: number;
  };
};

type PendingPayload = PendingTextPayload | PendingFilePayload | null;

export function isStaleAnalysisResult(expectedDocId: string, currentDocId: string | null): boolean {
  return currentDocId !== expectedDocId;
}

export function buildPendingAnalysisPayloadKey(payload: PendingPayload): string | null {
  if (!payload) return null;
  if (payload.kind === "text") {
    const len = payload.text.length;
    return `text:${payload.createdAt}:${len}`;
  }
  return `file:${payload.createdAt}:${payload.file.name}:${payload.file.size}`;
}

export function shouldResetPendingConsumeLatch(prevKey: string | null, nextKey: string | null): boolean {
  if (nextKey === null) return prevKey !== null;
  return prevKey !== nextKey;
}
