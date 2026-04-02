import { RING_CIRCUMFERENCE } from "./constants.js";

function buildDigitsMarkup(code, withPop) {
  const chars = code.split("");
  const digitClass = withPop ? "otp-digit pop" : "otp-digit";
  let html = "";

  for (let i = 0; i < chars.length; i += 1) {
    if (i === 3) {
      html += '<div class="otp-digit-sep"></div>';
    }
    html += `<div class="${digitClass}">${chars[i]}</div>`;
  }

  return html;
}

export function createOtpView(dom) {
  function renderDigits(code) {
    dom.otpDigits.innerHTML = buildDigitsMarkup(code, true);
  }

  function renderEmptyDigits() {
    dom.otpDigits.innerHTML = buildDigitsMarkup("------", false);
  }

  function setRingProgress(progress, remainSec) {
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
    dom.ringFg.style.strokeDashoffset = dashOffset.toFixed(2);
    dom.ringText.textContent = `${Math.ceil(remainSec)}s`;
    dom.progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
  }

  function setIdleView() {
    dom.ringText.textContent = "--";
    dom.ringFg.style.strokeDashoffset = "0";
    dom.progressBar.style.width = "0%";
    dom.otpSection.className = "otp-section";
    dom.copyHint.classList.remove("visible");
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
    renderDigits,
    renderEmptyDigits,
    setRingProgress,
    setIdleView,
    setOtpStateClass,
    showCopyHint,
    showCopyToast,
    hideCopyToast,
  };
}
