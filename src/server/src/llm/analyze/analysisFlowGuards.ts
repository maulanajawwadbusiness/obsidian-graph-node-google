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

function fnv1aHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function isStaleAnalysisResult(expectedDocId: string, currentDocId: string | null): boolean {
  return currentDocId !== expectedDocId;
}

export function buildPendingAnalysisPayloadKey(payload: PendingPayload): string | null {
  if (!payload) return null;
  if (payload.kind === "text") {
    const hash = fnv1aHash(payload.text);
    return `text:${payload.createdAt}:${payload.text.length}:${hash}`;
  }
  const metadataHash = fnv1aHash(`${payload.file.name}:${payload.file.size}`);
  return `file:${payload.createdAt}:${payload.file.name}:${payload.file.size}:${metadataHash}`;
}

export function shouldResetPendingConsumeLatch(prevKey: string | null, nextKey: string | null): boolean {
  if (nextKey === null) return prevKey !== null;
  return prevKey !== nextKey;
}
