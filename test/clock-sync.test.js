import assert from "node:assert/strict";
import test from "node:test";
import { createClockSync } from "../src/js/otp/clock-sync.js";

test("uses the midpoint of a server-time request", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const values = [1000, 1100, 1100, 1200];
  Date.now = () => values.shift() ?? 1200;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ serverTime: 6050 }),
  });

  try {
    const clock = createClockSync();
    assert.equal(await clock.syncClock(), true);
    assert.equal(clock.hasAuthoritativeTime(), true);
    assert.equal(clock.getSyncedNow(), 6200);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("falls back to the device clock when the API is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };

  try {
    const clock = createClockSync();
    const before = Date.now();
    assert.equal(await clock.syncClock(), true);
    const value = clock.getSyncedNow();
    const after = Date.now();
    assert.ok(value >= before && value <= after);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deduplicates concurrent synchronization requests", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await Promise.resolve();
    return {
      ok: true,
      json: async () => ({ serverTime: Date.now() }),
    };
  };

  try {
    const clock = createClockSync();
    const results = await Promise.all([
      clock.syncClock(),
      clock.syncClock(),
      clock.ensureFresh(),
    ]);
    assert.deepEqual(results, [true, true, true]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
