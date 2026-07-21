import {
  OTP_COPY_HINT_TEXT,
  OTP_EMPTY_CODE,
  OTP_REMAINING_PREFIX,
} from "./constants.js";

function buildDigitsMarkup(code, withPop) {
  const chars = code.split("");
  const digitClass = withPop ? "otp-digit pop" : "otp-digit";
  let html = "";

  for (let i = 0; i < chars.length; i += 1) {
    if (i === 3) {
      html += '<span class="otp-digit-sep" aria-hidden="true"></span>';
    }

    html += `<span class="${digitClass}"><span class="otp-digit-value">${chars[i]}</span></span>`;
  }

  return html;
}

export function createOtpView(dom) {
  let lastShownSecond = null;
  let lastRemainingProgress = null;

  function renderDigits(code) {
    dom.otpDigits.innerHTML = buildDigitsMarkup(code, true);
  }

  function renderEmptyDigits() {
    dom.otpDigits.innerHTML = buildDigitsMarkup(OTP_EMPTY_CODE, false);
  }

  function triggerTickAnimation() {
    dom.countdownBox.classList.remove("tick");
    void dom.countdownBox.offsetWidth;
    dom.countdownBox.classList.add("tick");

  }

  function setRingProgress(progress, remainSec) {
    const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const remainingProgress = 1 - safeProgress;
    const second = Math.max(0, Math.ceil(remainSec));

    dom.countdownBox.classList.remove("is-hidden");
    dom.ringText.textContent = `${OTP_REMAINING_PREFIX} ${second}s`;

    if (second !== lastShownSecond) {
      lastShownSecond = second;
      triggerTickAnimation();
    }

    const isNewCycle = lastRemainingProgress !== null
      && remainingProgress > lastRemainingProgress + 0.5;
    dom.progressBar.classList.toggle("is-resetting", isNewCycle);
    dom.progressBar.style.transform = `scaleX(${remainingProgress.toFixed(4)})`;
    if (isNewCycle) {
      void dom.progressBar.offsetWidth;
      dom.progressBar.classList.remove("is-resetting");
    }
    lastRemainingProgress = remainingProgress;
  }

  function setIdleView() {
    dom.ringText.textContent = "--";
    dom.progressBar.style.transform = "scaleX(0)";
    dom.otpSection.className = "otp-section";
    dom.copyHint.textContent = OTP_COPY_HINT_TEXT;
    dom.copyHint.classList.remove("visible");
    dom.copyToast.classList.remove("show");
    dom.countdownBox.classList.remove("tick");
    dom.countdownBox.classList.add("is-hidden");
    dom.progressBar.classList.remove("is-resetting");
    lastShownSecond = null;
    lastRemainingProgress = null;
  }

  function setOtpStateClass(remainSec) {
    let stateClass = "otp-section";

    if (remainSec <= 3) {
      stateClass += " state-danger";
    } else if (remainSec <= 7) {
      stateClass += " state-warning";
    }

    dom.otpSection.className = stateClass;
  }

  function showCopyHint() {
    dom.copyHint.classList.add("visible");
  }

  function showCopyToast() {
    dom.copyToast.classList.remove("show");
    void dom.copyToast.offsetWidth;
    dom.copyToast.classList.add("show");
  }

  function hideCopyToast() {
    dom.copyToast.classList.remove("show");
  }

  return {
    hideCopyToast,
    renderDigits,
    renderEmptyDigits,
    setIdleView,
    setOtpStateClass,
    setRingProgress,
    showCopyHint,
    showCopyToast,
  };
}
