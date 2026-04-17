const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP = new Map(
  BASE32_ALPHABET.split("").map((char, index) => [char, index]),
);
const SHA1_BLOCK_SIZE = 64;

function getOtpAuth() {
  return globalThis.OTPAuth || null;
}

function normalizeSecret(value) {
  return value
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

function isValidBase32(value) {
  return /^[A-Z2-7]+=*$/.test(value);
}

function leftRotate(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const array of arrays) {
    merged.set(array, offset);
    offset += array.length;
  }

  return merged;
}

function decodeBase32(base32Secret) {
  const compact = normalizeSecret(base32Secret).replace(/=+$/g, "");
  if (!compact || !isValidBase32(compact)) {
    throw new Error("Invalid Base32 secret.");
  }
  const lengthMod = compact.length % 8;
  if (![0, 2, 4, 5, 7].includes(lengthMod)) {
    throw new Error("Invalid Base32 secret.");
  }

  let bitsBuffer = 0;
  let bitsCount = 0;
  const out = [];

  for (const char of compact) {
    const value = BASE32_LOOKUP.get(char);
    if (value === undefined) {
      throw new Error("Invalid Base32 secret.");
    }

    bitsBuffer = (bitsBuffer << 5) | value;
    bitsCount += 5;

    while (bitsCount >= 8) {
      bitsCount -= 8;
      out.push((bitsBuffer >> bitsCount) & 0xff);
    }
  }

  if (!out.length) {
    throw new Error("Invalid Base32 secret.");
  }
  if (bitsCount > 0) {
    const remainderMask = (1 << bitsCount) - 1;
    if ((bitsBuffer & remainderMask) !== 0) {
      throw new Error("Invalid Base32 secret.");
    }
  }

  return Uint8Array.from(out);
}

function mapAmbiguousBase32(value, oneAs = "L") {
  return value
    .replace(/0/g, "O")
    .replace(/1/g, oneAs);
}

function collectRawSecretCandidates(raw) {
  const input = String(raw || "").trim();
  const candidates = [];
  const seen = new Set();

  const push = (value) => {
    const normalized = normalizeSecret(String(value || ""));
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  const labeledMatches = input.match(/(?:^|[?&\s|;,])secret\s*[:=]\s*([A-Za-z0-9=\s-]+)/gi) || [];
  for (const match of labeledMatches) {
    const value = match.replace(/^(?:.*?secret\s*[:=]\s*)/i, "");
    const tokens = value
      .split(/[^A-Za-z0-9=-]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const token of tokens) {
      push(token);
    }
  }

  const splitTokens = input
    .split(/[^A-Za-z0-9=-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of splitTokens) {
    push(token);
  }

  push(input);

  return candidates;
}

function bytesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

function ensureNotAmbiguousCandidate(candidate) {
  if (!/[01]/.test(candidate)) {
    return;
  }

  const mappedCandidates = [
    mapAmbiguousBase32(candidate, "L"),
    mapAmbiguousBase32(candidate, "I"),
  ];
  const decoded = [];
  const seen = new Set();

  for (const mapped of mappedCandidates) {
    if (!mapped || seen.has(mapped) || !isValidBase32(mapped)) {
      continue;
    }
    seen.add(mapped);

    try {
      decoded.push(decodeBase32(mapped));
    } catch {
    }
  }

  if (decoded.length >= 2) {
    const first = decoded[0];
    for (let i = 1; i < decoded.length; i += 1) {
      if (!bytesEqual(first, decoded[i])) {
        throw new Error("Ambiguous secret: replace 0->O and 1->I or 1->L before generating OTP.");
      }
    }
  }
}

function sha1(messageBytes) {
  const message = messageBytes instanceof Uint8Array ? messageBytes : Uint8Array.from(messageBytes);
  const bitLength = BigInt(message.length * 8);

  const withOne = new Uint8Array(message.length + 1);
  withOne.set(message, 0);
  withOne[message.length] = 0x80;

  const paddingLength = (64 - ((withOne.length + 8) % 64)) % 64;
  const padded = new Uint8Array(withOne.length + paddingLength + 8);
  padded.set(withOne, 0);

  for (let i = 0; i < 8; i += 1) {
    padded[padded.length - 1 - i] = Number((bitLength >> BigInt(i * 8)) & 0xffn);
  }

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const words = new Uint32Array(80);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const index = offset + i * 4;
      words[i] = (
        (padded[index] << 24)
        | (padded[index + 1] << 16)
        | (padded[index + 2] << 8)
        | padded[index + 3]
      ) >>> 0;
    }

    for (let i = 16; i < 80; i += 1) {
      words[i] = leftRotate(
        words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16],
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f = 0;
      let k = 0;

      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (leftRotate(a, 5) + f + e + k + words[i]) >>> 0;
      e = d;
      d = c;
      c = leftRotate(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const outputWords = [h0, h1, h2, h3, h4];

  for (let i = 0; i < outputWords.length; i += 1) {
    const word = outputWords[i];
    const index = i * 4;
    digest[index] = (word >>> 24) & 0xff;
    digest[index + 1] = (word >>> 16) & 0xff;
    digest[index + 2] = (word >>> 8) & 0xff;
    digest[index + 3] = word & 0xff;
  }

  return digest;
}

function hmacSha1(keyBytes, messageBytes) {
  let key = keyBytes;
  if (key.length > SHA1_BLOCK_SIZE) {
    key = sha1(key);
  }

  const block = new Uint8Array(SHA1_BLOCK_SIZE);
  block.set(key, 0);

  const innerPad = new Uint8Array(SHA1_BLOCK_SIZE);
  const outerPad = new Uint8Array(SHA1_BLOCK_SIZE);

  for (let i = 0; i < SHA1_BLOCK_SIZE; i += 1) {
    innerPad[i] = block[i] ^ 0x36;
    outerPad[i] = block[i] ^ 0x5c;
  }

  const innerHash = sha1(concatBytes(innerPad, messageBytes));
  return sha1(concatBytes(outerPad, innerHash));
}

function counterToBytes(counter) {
  const output = new Uint8Array(8);
  let value = BigInt(counter);

  for (let i = 7; i >= 0; i -= 1) {
    output[i] = Number(value & 0xffn);
    value >>= 8n;
  }

  return output;
}

function generateHotp(secretBytes, counter, digits) {
  const hash = hmacSha1(secretBytes, counterToBytes(counter));
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = (
    ((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff)
  ) >>> 0;
  const code = binary % (10 ** digits);
  return String(code).padStart(digits, "0");
}

class FallbackTotp {
  constructor({ secretBytes, digits = 6, period = 30, algorithm = "SHA1" }) {
    if (algorithm !== "SHA1") {
      throw new Error("Unsupported algorithm without OTPAuth library.");
    }
    if (!Number.isInteger(digits) || digits <= 0) {
      throw new Error("Invalid TOTP digits.");
    }
    if (!Number.isInteger(period) || period <= 0) {
      throw new Error("Invalid TOTP period.");
    }

    this.secretBytes = secretBytes;
    this.digits = digits;
    this.period = period;
  }

  generate({ timestamp = Date.now() } = {}) {
    const now = Number(timestamp);
    const counter = Math.floor(now / (this.period * 1000));
    return generateHotp(this.secretBytes, counter, this.digits);
  }
}

function parseOtpauthUriWithFallback(raw) {
  let parsedUrl;

  try {
    parsedUrl = new URL(raw);
  } catch {
    throw new Error("Invalid otpauth URI.");
  }

  if (!/^otpauth:$/i.test(parsedUrl.protocol) || !/^totp$/i.test(parsedUrl.hostname)) {
    throw new Error("URI is not a TOTP.");
  }

  const secret = parsedUrl.searchParams.get("secret") || "";
  if (!secret) {
    throw new Error("Missing secret in otpauth URI.");
  }

  const algorithm = (parsedUrl.searchParams.get("algorithm") || "SHA1").toUpperCase();
  const digits = Number.parseInt(parsedUrl.searchParams.get("digits") || "6", 10);
  const period = Number.parseInt(parsedUrl.searchParams.get("period") || "30", 10);
  const secretBytes = decodeBase32(secret);

  return new FallbackTotp({
    secretBytes,
    digits,
    period,
    algorithm,
  });
}

function buildTolerantOtpAuthTotp(secretCandidate, OTPAuth) {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretCandidate),
  });
}

export function parseInputToTotp(raw) {
  if (!raw) {
    return null;
  }

  const OTPAuth = getOtpAuth();

  if (/^otpauth:\/\//i.test(raw)) {
    if (OTPAuth) {
      const parsed = OTPAuth.URI.parse(raw);
      if (!(parsed instanceof OTPAuth.TOTP)) {
        throw new Error("URI is not a TOTP.");
      }
      return parsed;
    }

    return parseOtpauthUriWithFallback(raw);
  }

  const rawCandidates = collectRawSecretCandidates(raw);
  for (const candidate of rawCandidates) {
    ensureNotAmbiguousCandidate(candidate);
  }
  const normalizedCandidates = [];
  const seen = new Set();
  for (const baseCandidate of rawCandidates) {
    const options = [
      baseCandidate,
      mapAmbiguousBase32(baseCandidate, "L"),
      mapAmbiguousBase32(baseCandidate, "I"),
    ];

    for (const option of options) {
      if (!option || seen.has(option)) {
        continue;
      }
      seen.add(option);
      normalizedCandidates.push(option);
    }
  }

  if (OTPAuth) {
    for (const candidate of normalizedCandidates) {
      try {
        return buildTolerantOtpAuthTotp(candidate, OTPAuth);
      } catch {
      }
    }
  }

  for (const candidate of normalizedCandidates) {
    if (!isValidBase32(candidate)) {
      continue;
    }

    try {
      return new FallbackTotp({
        secretBytes: decodeBase32(candidate),
        digits: 6,
        period: 30,
        algorithm: "SHA1",
      });
    } catch {
    }
  }

  throw new Error("Invalid Base32 secret.");
}
