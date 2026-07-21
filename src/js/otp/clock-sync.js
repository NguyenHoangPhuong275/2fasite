import {
  CLOCK_SYNC_MAX_AGE_MS,
  CLOCK_TIMEOUT_MS,
  SERVER_TIME_ENDPOINT,
} from "./constants.js";

export function createClockSync() {
  let offsetMs = 0;
  let syncedAt = 0;
  let pendingSync = null;

  function applyOffset(value) {
    if (!Number.isFinite(value) || Math.abs(value) > 12 * 60 * 60 * 1000) {
      return false;
    }

    offsetMs = Math.round(value);
    syncedAt = Date.now();
    return true;
  }

  async function fetchServerTime() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLOCK_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(SERVER_TIME_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      const completedAt = Date.now();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const serverTime = Number(payload.serverTime);
      if (!Number.isFinite(serverTime)) {
        throw new Error("Invalid time payload");
      }

      return serverTime - ((startedAt + completedAt) / 2);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function getSyncedNow() {
    return Date.now() + offsetMs;
  }

  function hasAuthoritativeTime() {
    return syncedAt > 0;
  }

  function syncClock() {
    if (pendingSync) {
      return pendingSync;
    }

    pendingSync = fetchServerTime()
      .then((nextOffset) => applyOffset(nextOffset))
      .catch(() => applyOffset(0))
      .finally(() => {
        pendingSync = null;
      });

    return pendingSync;
  }

  function ensureFresh() {
    if (!syncedAt || Date.now() - syncedAt >= CLOCK_SYNC_MAX_AGE_MS) {
      return syncClock();
    }

    return Promise.resolve(true);
  }

  return {
    getSyncedNow,
    hasAuthoritativeTime,
    syncClock,
    ensureFresh,
  };
}
