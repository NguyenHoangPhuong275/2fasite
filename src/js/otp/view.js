import {
  OTP_COPY_HINT_TEXT,
  OTP_EMPTY_CODE,
  OTP_REMAINING_PREFIX,
} from "./constants.js";

function buildDigitsMarkup(code, withPop) {
  const chars = code.split("");
  const digitClass = withPop ? "otp-digit pop" : "otp-digit";
  let html = "";
  let animationOrder = 0;

  for (let i = 0; i < chars.length; i += 1) {
    if (i === 3) {
      html += '<div class="otp-digit-sep" aria-hidden="true"></div>';
    }

    const delayAttr = withPop ? ` style="animation-delay:${(animationOrder * 0.05).toFixed(2)}s"` : "";
    html += `<div class="${digitClass}"${delayAttr}>${chars[i]}</div>`;
    animationOrder += 1;
  }

  return html;
}

export function createOtpView(dom) {
  let lastShownSecond = null;

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

    dom.otpDigits.classList.remove("tick");
    void dom.otpDigits.offsetWidth;
    dom.otpDigits.classList.add("tick");
  }

  function setRingProgress(progress, remainSec) {
    const safeProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const second = Math.max(0, Math.ceil(remainSec));

    dom.countdownBox.classList.remove("is-hidden");
    dom.ringText.textContent = `${OTP_REMAINING_PREFIX} ${second}s`;

    if (second !== lastShownSecond) {
      lastShownSecond = second;
      triggerTickAnimation();
    }

    dom.progressBar.style.transform = `scaleX(${safeProgress.toFixed(4)})`;
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
    dom.otpDigits.classList.remove("tick");
    lastShownSecond = null;
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
