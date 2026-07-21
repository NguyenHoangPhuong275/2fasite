import { createClockSync } from "./clock-sync.js";
import { getOtpDom } from "./dom.js";
import {
  CLOCK_SYNC_MAX_AGE_MS,
  COPY_NOTIFICATION_DURATION_MS,
  OTP_COPY_HINT_TEXT,
  OTP_CLOCK_SYNC_ERROR_TEXT,
  OTP_DEFAULT_PERIOD_SECONDS,
  OTP_EMPTY_CODE,
  OTP_INPUT_PLACEHOLDER_TEXT,
  OTP_INVALID_SECRET_TEXT,
  UI_TICK_MAX_DELAY_MS,
} from "./constants.js";
import { parseInputToTotp } from "./totp.js";
import { createOtpView } from "./view.js";

export function initOtpApp() {
  const dom = getOtpDom();
  const view = createOtpView(dom);
  const clockSync = createClockSync();

  let currentTotp = null;
  let currentCode = "";
  let lastStep = -1;
  let copyTimeout = null;
  let tickerId = 0;
  let clockRefreshId = 0;
  let submissionId = 0;

  function resetOtpState() {
    currentTotp = null;
    currentCode = "";
    lastStep = -1;
    view.renderEmptyDigits();
    view.setIdleView();
    dom.copyHint.textContent = OTP_COPY_HINT_TEXT;
  }

  function analyzeNow(force = false) {
    if (!currentTotp) {
      return;
    }

    if (!clockSync.hasAuthoritativeTime()) {
      currentCode = OTP_EMPTY_CODE;
      lastStep = -1;
      view.renderEmptyDigits();
      view.setIdleView();
      dom.copyHint.textContent = OTP_CLOCK_SYNC_ERROR_TEXT;
      dom.copyHint.classList.add("visible");
      return;
    }

    const now = clockSync.getSyncedNow();
    const periodMs = (currentTotp.period || OTP_DEFAULT_PERIOD_SECONDS) * 1000;
    const elapsed = ((now % periodMs) + periodMs) % periodMs;
    const remainMs = periodMs - elapsed;
    const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
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
    const requestId = ++submissionId;
    const input = String(dom.rawInput.value ?? "").trim();
    dom.rawInput.value = input;

    if (!input) {
      resetOtpState();
      return;
    }

    try {
      dom.copyHint.textContent = OTP_COPY_HINT_TEXT;
      const nextTotp = parseInputToTotp(input);
      const syncOk = await clockSync.ensureFresh();

      if (requestId !== submissionId) {
        return;
      }

      if (!syncOk || !clockSync.hasAuthoritativeTime()) {
        resetOtpState();
        dom.copyHint.textContent = OTP_CLOCK_SYNC_ERROR_TEXT;
        dom.copyHint.classList.add("visible");
        return;
      }

      currentTotp = nextTotp;
      lastStep = -1;
      analyzeNow(true);
    } catch (error) {
      if (requestId !== submissionId) {
        return;
      }
      resetOtpState();
      dom.copyHint.textContent = error instanceof Error && error.message
        ? error.message
        : OTP_INVALID_SECRET_TEXT;
      dom.copyHint.classList.add("visible");
    }
  }

  async function onCopyClick() {
    if (!currentTotp || !currentCode || currentCode === OTP_EMPTY_CODE) {
      return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentCode);
      view.showCopyToast();
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => view.hideCopyToast(), COPY_NOTIFICATION_DURATION_MS);
    } catch {
    }
  }

  function startLoop() {
    if (tickerId) {
      clearTimeout(tickerId);
    }

    const tick = () => {
      if (currentTotp) {
        analyzeNow();
      }
      const now = clockSync.getSyncedNow();
      const untilNextSecond = 1000 - (((now % 1000) + 1000) % 1000);
      const delay = currentTotp
        ? Math.min(UI_TICK_MAX_DELAY_MS, untilNextSecond + 5)
        : 1000;
      tickerId = setTimeout(tick, delay);
    };

    tick();

    if (clockRefreshId) {
      clearInterval(clockRefreshId);
    }
    clockRefreshId = setInterval(() => {
      void clockSync.ensureFresh();
    }, CLOCK_SYNC_MAX_AGE_MS);
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

  dom.rawInput.addEventListener("paste", (event) => {
    const pasted = (event.clipboardData || window.clipboardData)?.getData("text");
    if (typeof pasted === "string") {
      event.preventDefault();
      dom.rawInput.value = pasted.trim();
    }
  });

  dom.otpContainer.addEventListener("click", () => {
    void onCopyClick();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(tickerId);
      tickerId = 0;
      return;
    }

    void clockSync.ensureFresh().then(() => {
      analyzeNow(true);
      startLoop();
    });
  });

  resetOtpState();
  dom.rawInput.placeholder = OTP_INPUT_PLACEHOLDER_TEXT;
  void clockSync.syncClock();
  startLoop();
}
