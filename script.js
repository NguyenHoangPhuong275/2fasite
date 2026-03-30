"use strict";

const rawInput = document.getElementById("rawInput");
const otpDigits = document.getElementById("otpDigits");
const otpContainer = document.getElementById("otpContainer");
const otpSection = document.getElementById("otpSection");
const copyToast = document.getElementById("copyToast");
const copyHint = document.getElementById("copyHint");
const progressBar = document.getElementById("progressBar");
const ringFg = document.getElementById("ringFg");
const ringText = document.getElementById("ringText");
const submitBtn = document.getElementById("submitBtn");

if (
  !rawInput ||
  !otpDigits ||
  !otpContainer ||
  !otpSection ||
  !copyToast ||
  !copyHint ||
  !progressBar ||
  !ringFg ||
  !ringText ||
  !submitBtn
) {
  throw new Error("Missing required DOM element.");
}

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CLOCK_SYNC_MAX_AGE_MS = 5 * 60 * 1000;
const CLOCK_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const CLOCK_TIMEOUT_MS = 3500;
const SERVER_TIME_ENDPOINT = "/api/time";
const PUBLIC_TIME_API_ENDPOINT = "https://www.timeapi.io/api/Time/current/zone?timeZone=UTC";

let currentTotp = null;
let currentCode = "";
let lastStep = -1;
let copyTimeout = null;
let rafId = 0;
let lastRafSyncCheck = 0;

let timeOffset = 0;
let lastSyncAt = 0;
let syncingPromise = null;

function buildDigitsMarkup(code, withPop) {
  const chars = code.split("");
  const digitClass = withPop ? "otp-digit pop" : "otp-digit";
  let html = "";

  for (let i = 0; i < chars.length; i += 1) {
    if (i === 3) html += '<div class="otp-digit-sep"></div>';
    html += `<div class="${digitClass}">${chars[i]}</div>`;
  }

  return html;
}

function renderDigits(code) {
  otpDigits.innerHTML = buildDigitsMarkup(code, true);
}

function renderEmptyDigits() {
  otpDigits.innerHTML = buildDigitsMarkup("------", false);
}

function setRingProgress(progress, remainSec) {
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  ringFg.style.strokeDashoffset = dashOffset.toFixed(2);
  ringText.textContent = `${Math.ceil(remainSec)}s`;
  progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
}

function setIdleView() {
  ringText.textContent = "--";
  ringFg.style.strokeDashoffset = "0";
  progressBar.style.width = "0%";
  otpSection.className = "otp-section";
  copyHint.classList.remove("visible");
}

function resetOtpState() {
  currentTotp = null;
  currentCode = "";
  lastStep = -1;
  renderEmptyDigits();
  setIdleView();
}

function setOtpStateClass(remainSec) {
  let stateClass = "otp-section";
  if (remainSec <= 3) stateClass += " state-danger";
  else if (remainSec <= 7) stateClass += " state-warning";
  otpSection.className = stateClass;
}

function normalizeSecret(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidBase32(value) {
  return /^[A-Z2-7]+=*$/.test(value);
}

function buildStrictTotp(secretBase32) {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

function parseInputToTotp(raw) {
  if (!raw) return null;

  if (/^otpauth:\/\//i.test(raw)) {
    const parsed = OTPAuth.URI.parse(raw);
    if (!(parsed instanceof OTPAuth.TOTP)) {
      throw new Error("URI is not a TOTP.");
    }
    return parsed;
  }

  const clean = normalizeSecret(raw);
  if (!isValidBase32(clean)) {
    throw new Error("Invalid Base32 secret.");
  }

  return buildStrictTotp(clean);
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
  if (!Number.isFinite(nextOffset)) return false;
  if (Math.abs(nextOffset) > 12 * 60 * 60 * 1000) return false;

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
  if (!response.ok) throw new Error(`/api/time HTTP ${response.status}`);

  const data = await response.json();
  const serverTime = Number(data.serverTime ?? data.now ?? data.timestamp);
  if (!Number.isFinite(serverTime)) throw new Error("Invalid /api/time payload.");

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
  if (!response.ok) throw new Error(`timeapi.io HTTP ${response.status}`);

  const data = await response.json();
  const year = Number(data.year);
  const month = Number(data.month);
  const day = Number(data.day);
  const hour = Number(data.hour);
  const minute = Number(data.minute);
  const second = Number(data.seconds);
  const ms = Number(data.milliSeconds);
  const serverTime = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  if (!Number.isFinite(serverTime)) throw new Error("Invalid timeapi.io payload.");

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
  if (syncingPromise) return syncingPromise;

  syncingPromise = (async () => {
    try {
      await syncFromServerApi();
    } catch {
      try {
        await syncFromPublicTimeApi();
      } catch {
        if (!lastSyncAt) timeOffset = 0;
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

function analyzeNow(force = false) {
  if (!currentTotp) {
    renderEmptyDigits();
    setIdleView();
    return;
  }

  const now = getSyncedNow();
  const periodMs = (currentTotp.period || 30) * 1000;
  const elapsed = ((now % periodMs) + periodMs) % periodMs;
  const remainMs = periodMs - elapsed;
  const remainSec = remainMs / 1000;
  const step = Math.floor(now / periodMs);

  if (force || step !== lastStep) {
    lastStep = step;
    currentCode = currentTotp.generate({ timestamp: now });
    renderDigits(currentCode);
    copyHint.classList.add("visible");
  }

  setRingProgress(elapsed / periodMs, remainSec);
  setOtpStateClass(remainSec);
}

async function onInputSubmit() {
  const raw = rawInput.value.trim();
  if (!raw) {
    resetOtpState();
    return;
  }

  try {
    currentTotp = parseInputToTotp(raw);
    lastStep = -1;
    await ensureFresh();
    analyzeNow(true);
  } catch {
    resetOtpState();
  }
}

async function onCopyClick() {
  if (!currentTotp) return;
  if (!currentCode || currentCode === "------") return;
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") return;

  try {
    await navigator.clipboard.writeText(currentCode);
    copyToast.classList.add("show");
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => copyToast.classList.remove("show"), 1200);
  } catch {
  }
}

function startLoop() {
  cancelAnimationFrame(rafId);

  const tick = (ts) => {
    if (ts - lastRafSyncCheck > 1000) {
      lastRafSyncCheck = ts;
      void ensureFresh();
    }

    analyzeNow();
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

submitBtn.addEventListener("click", () => {
  void onInputSubmit();
});

rawInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  void onInputSubmit();
});

otpContainer.addEventListener("click", () => {
  void onCopyClick();
});

setInterval(() => {
  void syncClock();
}, CLOCK_SYNC_INTERVAL_MS);

resetOtpState();
void syncClock();
startLoop();

// Modal Logic
const contactBtn = document.getElementById("contactBtn");
const contactModal = document.getElementById("contactModal");
const closeContactBtn = document.getElementById("closeContactBtn");

if (contactBtn && contactModal && closeContactBtn) {
  contactBtn.addEventListener("click", (e) => {
    e.preventDefault();
    contactModal.classList.add("active");
  });

  closeContactBtn.addEventListener("click", () => {
    contactModal.classList.remove("active");
  });

  contactModal.addEventListener("click", (e) => {
    if (e.target === contactModal) {
      contactModal.classList.remove("active");
    }
  });
}
