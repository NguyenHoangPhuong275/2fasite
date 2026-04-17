import {
  CLOCK_SYNC_MAX_AGE_MS,
  CLOCK_TIMEOUT_MS,
  PUBLIC_TIME_API_ENDPOINT,
  SERVER_TIME_ENDPOINT,
} from "./constants.js";

export function createClockSync() {
  let timeOffset = 0;
  let lastSyncAt = 0;
  let syncingPromise = null;
  const publicTimePreferredHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

  function shouldPreferPublicTime() {
    const hostname = String(globalThis.location?.hostname || "").toLowerCase();
    return publicTimePreferredHostnames.has(hostname);
  }

  async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOCK_TIMEOUT_MS);

    try {
      return await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        ...init,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function applyComputedOffset(nextOffset) {
    if (!Number.isFinite(nextOffset)) {
      return false;
    }

    if (Math.abs(nextOffset) > 12 * 60 * 60 * 1000) {
      return false;
    }

    if (lastSyncAt && Math.abs(nextOffset - timeOffset) < 1500) {
      timeOffset = Math.round((timeOffset * 4 + nextOffset) / 5);
    } else {
      timeOffset = nextOffset;
    }

    lastSyncAt = Date.now();
    return true;
  }

  async function syncFromServerApi() {
    const t0 = Date.now();
    const response = await fetchWithTimeout(SERVER_TIME_ENDPOINT, { method: "GET" });
    const t1 = Date.now();

    if (!response.ok) {
      throw new Error(`/api/time HTTP ${response.status}`);
    }

    const data = await response.json();
    const serverTime = Number(data.serverTime ?? data.now ?? data.timestamp);

    if (!Number.isFinite(serverTime)) {
      throw new Error("Invalid /api/time payload.");
    }

    const rtt = t1 - t0;
    const nextOffset = serverTime - t1 + Math.floor(rtt / 2);

    if (!applyComputedOffset(nextOffset)) {
      throw new Error("Invalid /api/time offset.");
    }
  }

  async function syncFromPublicTimeApi() {
    const t0 = Date.now();
    const response = await fetchWithTimeout(PUBLIC_TIME_API_ENDPOINT, { method: "GET" });
    const t1 = Date.now();

    if (!response.ok) {
      throw new Error(`timeapi.io HTTP ${response.status}`);
    }

    const data = await response.json();
    const year = Number(data.year);
    const month = Number(data.month);
    const day = Number(data.day);
    const hour = Number(data.hour);
    const minute = Number(data.minute);
    const second = Number(data.seconds ?? data.second);
    const ms = Number(data.milliSeconds ?? data.milliseconds ?? data.millisecond ?? 0);
    const serverTime = Date.UTC(year, month - 1, day, hour, minute, second, ms);

    if (!Number.isFinite(serverTime)) {
      throw new Error("Invalid timeapi.io payload.");
    }

    const rtt = t1 - t0;
    const nextOffset = serverTime - t1 + Math.floor(rtt / 2);

    if (!applyComputedOffset(nextOffset)) {
      throw new Error("Invalid timeapi.io offset.");
    }
  }

  function getSyncedNow() {
    return Date.now() + timeOffset;
  }

  async function syncClock() {
    if (syncingPromise) {
      return syncingPromise;
    }

    syncingPromise = (async () => {
      const syncStrategies = shouldPreferPublicTime()
        ? [syncFromPublicTimeApi, syncFromServerApi]
        : [syncFromServerApi, syncFromPublicTimeApi];

      try {
        for (const strategy of syncStrategies) {
          try {
            await strategy();
            return;
          } catch {
          }
        }
        if (!lastSyncAt) {
          timeOffset = 0;
        }
      } finally {
        syncingPromise = null;
      }
    })();

    return syncingPromise;
  }

  async function ensureFresh() {
    if (!lastSyncAt || Date.now() - lastSyncAt > CLOCK_SYNC_MAX_AGE_MS) {
      await syncClock();
    }
  }

  return {
    getSyncedNow,
    syncClock,
    ensureFresh,
  };
}
