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

const pendingPayloadKeyCache = new WeakMap<object, string>();
let pendingKeyComputeCount = 0;

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
  const cached = pendingPayloadKeyCache.get(payload);
  if (cached) return cached;
  pendingKeyComputeCount += 1;
  let computed: string;
  if (payload.kind === "text") {
    const hash = fnv1aHash(payload.text);
    computed = `text:${payload.createdAt}:${payload.text.length}:${hash}`;
  } else {
    const metadataHash = fnv1aHash(`${payload.file.name}:${payload.file.size}`);
    computed = `file:${payload.createdAt}:${payload.file.name}:${payload.file.size}:${metadataHash}`;
  }
  pendingPayloadKeyCache.set(payload, computed);
  return computed;
}

export function shouldResetPendingConsumeLatch(prevKey: string | null, nextKey: string | null): boolean {
  if (nextKey === null) return prevKey !== null;
  return prevKey !== nextKey;
}

export function __resetPendingKeyComputeCountForTests(): void {
  pendingKeyComputeCount = 0;
}

export function __getPendingKeyComputeCountForTests(): number {
  return pendingKeyComputeCount;
}
