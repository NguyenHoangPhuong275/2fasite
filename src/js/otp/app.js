import { createClockSync } from "./clock-sync.js";
import { getOtpDom } from "./dom.js";
import {
  OTP_COPY_HINT_TEXT,
  OTP_DEFAULT_PERIOD_SECONDS,
  OTP_EMPTY_CODE,
  OTP_INPUT_PLACEHOLDER_TEXT,
  OTP_INVALID_SECRET_TEXT,
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
  let freshTimerId = 0;

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
      view.renderEmptyDigits();
      view.setIdleView();
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
    const sanitized = dom.rawInput.value.trim();
    dom.rawInput.value = sanitized;

    if (!sanitized) {
      resetOtpState();
      return;
    }

    try {
      dom.copyHint.textContent = OTP_COPY_HINT_TEXT;
      currentTotp = parseInputToTotp(sanitized);
      lastStep = -1;
      analyzeNow(true);
      void clockSync.ensureFresh().then(() => {
        analyzeNow(true);
      });
    } catch (error) {
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
      copyTimeout = setTimeout(() => view.hideCopyToast(), 1200);
    } catch {
    }
  }

  function startLoop() {
    if (tickerId) {
      cancelAnimationFrame(tickerId);
    }

    const tick = () => {
      analyzeNow();
      tickerId = requestAnimationFrame(tick);
    };

    tick();

    if (freshTimerId) {
      clearInterval(freshTimerId);
    }

    freshTimerId = setInterval(() => {
      void clockSync.ensureFresh();
    }, 1000);
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
    event.preventDefault();
    const pasted = (event.clipboardData || window.clipboardData).getData("text");
    dom.rawInput.value = pasted.trim();
  });

  dom.otpContainer.addEventListener("click", () => {
    void onCopyClick();
  });

  resetOtpState();
  dom.rawInput.placeholder = OTP_INPUT_PLACEHOLDER_TEXT;
  void clockSync.syncClock();
  startLoop();
}
