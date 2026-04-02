function getOtpAuth() {
  if (!globalThis.OTPAuth) {
    throw new Error("OTPAuth library is not loaded.");
  }
  return globalThis.OTPAuth;
}

function normalizeSecret(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidBase32(value) {
  return /^[A-Z2-7]+=*$/.test(value);
}

function buildStrictTotp(secretBase32) {
  const OTPAuth = getOtpAuth();

  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function parseInputToTotp(raw) {
  if (!raw) {
    return null;
  }

  const OTPAuth = getOtpAuth();

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
