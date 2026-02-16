export function createSilentLogger() {
  return {
    log: () => {
      // no-op
    },
    warn: () => {
      // no-op
    },
    error: () => {
      // no-op
    }
  };
}
