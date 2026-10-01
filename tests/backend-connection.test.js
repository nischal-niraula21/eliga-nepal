import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { createApiConnection } from "../src/api/connection.js";

const readinessOptions = { maxWaitMs: 1000, retryDelayMs: 1, noticeAfterMs: 5 };
const response = (config, data = {}) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const networkError = (config) => new axios.AxiosError("Network unavailable", "ERR_NETWORK", config);

test("concurrent reads and an action wait for one shared wake-up sequence", async () => {
  let probes = 0;
  let ready = false;
  const sent = [];
  const { api } = createApiConnection("https://example.test/api", {
    readinessOptions,
    getToken: () => "player-token",
    adapter: async (config) => {
      if (config.url === "/health") {
        assert.equal(config.headers.Authorization, undefined);
        probes += 1;
        if (probes === 1) return response(config, "<html>Starting service</html>");
        if (probes === 2) throw networkError(config);
        ready = true;
        return response(config, { ok: true });
      }
      assert.equal(ready, true);
      assert.equal(config.headers.Authorization, "Bearer player-token");
      sent.push(config.url);
      return response(config);
    }
  });
  await Promise.all([api.get("/wallet"), api.get("/rooms/mine"), api.post("/rooms", { entryFee: 20 })]);
  assert.equal(probes, 3);
  assert.deepEqual(sent.sort(), ["/rooms", "/rooms/mine", "/wallet"]);
  await api.get("/wallet/notifications");
  assert.equal(probes, 3, "recent API traffic reuses the ready connection");
});

test("a temporary read failure rechecks health and retries the read once", async () => {
  let probes = 0;
  let reads = 0;
  const { api } = createApiConnection("https://example.test/api", {
    readinessOptions,
    adapter: async (config) => {
      if (config.url === "/health") {
        probes += 1;
        return response(config, { ok: true });
      }
      reads += 1;
      if (reads === 1) throw networkError(config);
      return response(config, { balance: 100 });
    }
  });
  assert.equal((await api.get("/wallet")).data.balance, 100);
  assert.equal(reads, 2);
  assert.equal(probes, 2);
});

test("a read that keeps failing stops after one retry", async () => {
  let reads = 0;
  const { api } = createApiConnection("https://example.test/api", {
    readinessOptions,
    adapter: async (config) => {
      if (config.url === "/health") return response(config, { ok: true });
      reads += 1;
      throw networkError(config);
    }
  });
  await assert.rejects(api.get("/wallet"), { code: "ERR_NETWORK" });
  assert.equal(reads, 2);
});

test("lost action responses never replay money-moving requests", async () => {
  for (const method of ["post", "patch", "put", "delete"]) {
    let actions = 0;
    const { api } = createApiConnection("https://example.test/api", {
      readinessOptions,
      adapter: async (config) => {
        if (config.url === "/health") return response(config, { ok: true });
        actions += 1;
        throw networkError(config);
      }
    });
    await assert.rejects(api.request({ method, url: "/rooms/test/join" }), { code: "ERR_NETWORK" });
    assert.equal(actions, 1, `${method} must be sent only once`);
  }
});

test("an unavailable backend has a bounded wait and receives no queued payment", async () => {
  let actions = 0;
  const { api, backend } = createApiConnection("https://example.test/api", {
    readinessOptions: { ...readinessOptions, maxWaitMs: 25 },
    adapter: async (config) => {
      if (config.url !== "/health") actions += 1;
      throw networkError(config);
    }
  });
  await assert.rejects(api.post("/rooms/test/join"), { code: "BACKEND_UNAVAILABLE" });
  assert.equal(actions, 0);
  assert.equal(backend.getStatus(), "unavailable");
});

test("canceling one waiting request does not cancel other requests", async () => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const sent = [];
  const { api, backend } = createApiConnection("https://example.test/api", {
    readinessOptions: { ...readinessOptions, maxWaitMs: 1000 },
    adapter: async (config) => {
      if (config.url === "/health") {
        await waiting;
        return response(config, { ok: true });
      }
      sent.push(config.url);
      return response(config);
    }
  });
  const controller = new AbortController();
  const canceled = api.post("/rooms", {}, { signal: controller.signal });
  const remaining = api.get("/wallet");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(backend.getStatus(), "connecting");
  controller.abort();
  release();
  await assert.rejects(canceled, { code: "ERR_CANCELED" });
  await remaining;
  assert.deepEqual(sent, ["/wallet"]);
  assert.equal(backend.getStatus(), "ready");
});

test("an expired login response is not retried or hidden by the wake-up handler", async () => {
  let reads = 0;
  const { api } = createApiConnection("https://example.test/api", {
    readinessOptions,
    adapter: async (config) => {
      if (config.url === "/health") return response(config, { ok: true });
      reads += 1;
      const reply = { ...response(config), status: 401 };
      throw new axios.AxiosError("Expired session", "ERR_BAD_REQUEST", config, null, reply);
    }
  });
  await assert.rejects(api.get("/auth/me"), (error) => error.response.status === 401);
  assert.equal(reads, 1);
});
