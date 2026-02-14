export function createLlmRuntimeState(opts?: { maxConcurrentLlm?: number }) {
  const llmConcurrency = new Map<string, number>();
  const maxConcurrentLlm = Number(opts?.maxConcurrentLlm ?? 2);
  let llmRequestsTotal = 0;
  let llmRequestsInflight = 0;
  let llmRequestsStreaming = 0;

  function acquireLlmSlot(userId: string): boolean {
    const current = llmConcurrency.get(userId) || 0;
    if (current >= maxConcurrentLlm) return false;
    llmConcurrency.set(userId, current + 1);
    return true;
  }

  function releaseLlmSlot(userId: string) {
    const current = llmConcurrency.get(userId) || 0;
    const next = current - 1;
    if (next <= 0) llmConcurrency.delete(userId);
    else llmConcurrency.set(userId, next);
  }

  function incRequestsTotal() {
    llmRequestsTotal += 1;
  }

  function incRequestsInflight() {
    llmRequestsInflight += 1;
  }

  function decRequestsInflight() {
    llmRequestsInflight -= 1;
  }

  function incRequestsStreaming() {
    llmRequestsStreaming += 1;
  }

  function decRequestsStreaming() {
    llmRequestsStreaming -= 1;
  }

  function startPeriodicLog(intervalMs = 60000) {
    setInterval(() => {
      console.log(JSON.stringify({
        llm_requests_total: llmRequestsTotal,
        llm_requests_inflight: llmRequestsInflight,
        llm_requests_streaming: llmRequestsStreaming
      }));
    }, intervalMs);
  }

  return {
    acquireLlmSlot,
    releaseLlmSlot,
    incRequestsTotal,
    incRequestsInflight,
    decRequestsInflight,
    incRequestsStreaming,
    decRequestsStreaming,
    startPeriodicLog
  };
}

