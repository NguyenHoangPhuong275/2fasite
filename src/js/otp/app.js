import { CLOCK_SYNC_INTERVAL_MS } from "./constants.js";
import { getOtpDom } from "./dom.js";
import { createOtpView } from "./view.js";
import { parseInputToTotp } from "./totp.js";
import { createClockSync } from "./clock-sync.js";

export function initOtpApp() {
  const dom = getOtpDom();
  const view = createOtpView(dom);
  const clockSync = createClockSync();

  let currentTotp = null;
  let currentCode = "";
  let lastStep = -1;
  let copyTimeout = null;
  let rafId = 0;
  let lastRafSyncCheck = 0;

  function resetOtpState() {
    currentTotp = null;
    currentCode = "";
    lastStep = -1;
    view.renderEmptyDigits();
    view.setIdleView();
  }

  function analyzeNow(force = false) {
    if (!currentTotp) {
      view.renderEmptyDigits();
      view.setIdleView();
      return;
    }

    const now = clockSync.getSyncedNow();
    const periodMs = (currentTotp.period || 30) * 1000;
    const elapsed = ((now % periodMs) + periodMs) % periodMs;
    const remainMs = periodMs - elapsed;
    const remainSec = remainMs / 1000;
    const step = Math.floor(now / periodMs);

    if (force || step !== lastStep) {
      lastStep = step;
      currentCode = currentTotp.generate({ timestamp: now });
      view.renderDigits(currentCode);
      view.showCopyHint();
    }

    view.setRingProgress(elapsed / periodMs, remainSec);
    view.setOtpStateClass(remainSec);
  }

  async function onInputSubmit() {
    const raw = dom.rawInput.value.trim();
    if (!raw) {
      resetOtpState();
      return;
    }

    try {
      currentTotp = parseInputToTotp(raw);
      lastStep = -1;
      await clockSync.ensureFresh();
      analyzeNow(true);
    } catch {
      resetOtpState();
    }
  }

  async function onCopyClick() {
    if (!currentTotp) {
      return;
    }

    if (!currentCode || currentCode === "------") {
      return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentCode);
      view.showCopyToast();
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => view.hideCopyToast(), 1200);
    } catch {
    }
  }

  function startLoop() {
    cancelAnimationFrame(rafId);

    const tick = (ts) => {
      if (ts - lastRafSyncCheck > 1000) {
        lastRafSyncCheck = ts;
        void clockSync.ensureFresh();
      }

      analyzeNow();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  dom.submitBtn.addEventListener("click", () => {
    void onInputSubmit();
  });

  dom.rawInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void onInputSubmit();
  });

  dom.otpContainer.addEventListener("click", () => {
    void onCopyClick();
  });

  setInterval(() => {
    void clockSync.syncClock();
  }, CLOCK_SYNC_INTERVAL_MS);

  resetOtpState();
  void clockSync.syncClock();
  startLoop();
}
