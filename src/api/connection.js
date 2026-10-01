import axios from "axios";
import { createReadinessGate } from "./readiness.js";

function isTemporaryFailure(error) {
  return ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error.code) ||
    [502, 503, 504].includes(error.response?.status);
}

export function createApiConnection(baseURL, { getToken = () => null, adapter, readinessOptions } = {}) {
  const options = { baseURL, ...(adapter ? { adapter } : {}) };
  const health = axios.create(options);
  const api = axios.create({ ...options, timeout: 30000 });
  const backend = createReadinessGate(async ({ timeout }) => {
    const { data } = await health.get("/health", { timeout });
    // Render can return a loading page while waking; that is not API readiness.
    if (data?.ok !== true) throw new Error("Waiting for the eLeague API.");
  }, readinessOptions);

  api.interceptors.request.use(async (config) => {
    if (config.signal?.aborted) throw new axios.CanceledError();
    await backend.ensureReady();
    if (config.signal?.aborted) throw new axios.CanceledError();
    const token = getToken(config);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;
    return config;
  });

  api.interceptors.response.use((response) => {
    backend.markReady();
    return response;
  }, (error) => {
    const config = error.config;
    if (isTemporaryFailure(error)) {
      backend.invalidate();
      // Never replay payments, room creation, approvals, or other mutations.
      if (config && ["get", "head"].includes(config.method) && !config.retriedAfterWake) {
        return api.request({ ...config, retriedAfterWake: true });
      }
    }
    return Promise.reject(error);
  });

  return { api, backend };
}
