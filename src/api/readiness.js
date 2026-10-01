const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only health checks are repeated here. Queued actions are sent after readiness.
export function createReadinessGate(check, {
  maxWaitMs = 120000,
  probeTimeoutMs = 15000,
  retryDelayMs = 2000,
  freshForMs = 5 * 60 * 1000,
  noticeAfterMs = 1500
} = {}) {
  let lastReadyAt = 0;
  let pending = null;
  let status = "idle";
  const listeners = new Set();

  function setStatus(next) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  function markReady() {
    lastReadyAt = Date.now();
    setStatus("ready");
  }

  async function connect() {
    const deadline = Date.now() + maxWaitMs;
    const notice = setTimeout(() => setStatus("connecting"), noticeAfterMs);
    try {
      while (Date.now() < deadline) {
        try {
          await check({ timeout: Math.max(1, Math.min(probeTimeoutMs, deadline - Date.now())) });
          markReady();
          return;
        } catch (error) {
          const httpStatus = error.response?.status;
          // A wrong URL or denied origin needs configuration, not more retries.
          if (httpStatus >= 400 && httpStatus < 500 && ![408, 429].includes(httpStatus)) throw error;
        }
        const remaining = deadline - Date.now();
        if (remaining > 0) await pause(Math.min(retryDelayMs, remaining));
      }
      throw new Error("Backend readiness timed out.");
    } catch (cause) {
      setStatus("unavailable");
      const error = new Error("Could not connect to eLeague. Check your connection and try again.", { cause });
      error.code = "BACKEND_UNAVAILABLE";
      throw error;
    } finally {
      clearTimeout(notice);
    }
  }

  return {
    ensureReady() {
      if (pending) return pending;
      if (lastReadyAt && Date.now() - lastReadyAt < freshForMs) return Promise.resolve();
      pending = connect().finally(() => { pending = null; });
      return pending;
    },
    markReady,
    invalidate() { lastReadyAt = 0; },
    getStatus() { return status; },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
