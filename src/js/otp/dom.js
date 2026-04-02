function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM element: #${id}`);
  }
  return element;
}

export function getOtpDom() {
  return {
    rawInput: requireElement("rawInput"),
    otpDigits: requireElement("otpDigits"),
    otpContainer: requireElement("otpContainer"),
    otpSection: requireElement("otpSection"),
    copyToast: requireElement("copyToast"),
    copyHint: requireElement("copyHint"),
    progressBar: requireElement("progressBar"),
    ringFg: requireElement("ringFg"),
    ringText: requireElement("ringText"),
    submitBtn: requireElement("submitBtn"),
  };
}
