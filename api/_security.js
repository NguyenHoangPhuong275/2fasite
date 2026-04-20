const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const RATE_LIMIT_STATE = new Map();

function getHeader(req, name) {
  const value = req.headers?.[name];
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
}

function getRequestHost(req) {
  return getHeader(req, "x-forwarded-host").toLowerCase() || getHeader(req, "host").toLowerCase();
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopback(hostname) {
  return LOOPBACK_HOSTNAMES.has(String(hostname || "").toLowerCase());
}

function parseAllowedOrigins(rawValue) {
  const list = String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(list);
}

function isTrustedUrl(urlValue, req, allowlist) {
  const url = parseUrl(urlValue);
  if (!url) {
    return false;
  }

  const requestHost = getRequestHost(req);
  if (!requestHost) {
    return false;
  }

  if (url.host.toLowerCase() === requestHost) {
    return true;
  }

  if (isLoopback(url.hostname)) {
    return true;
  }

  return allowlist.has(url.origin);
}

function appendVaryOrigin(res) {
  const previous = String(res.getHeader("Vary") || "");
  if (!previous) {
    res.setHeader("Vary", "Origin");
    return;
  }

  if (!previous.toLowerCase().split(",").map((part) => part.trim()).includes("origin")) {
    res.setHeader("Vary", `${previous}, Origin`);
  }
}

function getClientIp(req) {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return getHeader(req, "x-real-ip") || "unknown";
}

export function applyCors(req, res, options = {}) {
  const {
    methods = ["GET", "POST", "OPTIONS"],
    headers = ["Content-Type"],
  } = options;

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const origin = getHeader(req, "origin");
  const originTrusted = origin ? isTrustedUrl(origin, req, allowedOrigins) : false;

  appendVaryOrigin(res);
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", headers.join(", "));

  if (originTrusted) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  return { originTrusted };
}

export function ensureTrustedBrowserRequest(req, res) {
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const origin = getHeader(req, "origin");
  const referer = getHeader(req, "referer");
  const secFetchSite = getHeader(req, "sec-fetch-site").toLowerCase();
  const trustedOrigin = origin ? isTrustedUrl(origin, req, allowedOrigins) : false;
  const trustedReferer = referer ? isTrustedUrl(referer, req, allowedOrigins) : false;

  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    res.status(403).json({ error: "Forbidden origin" });
    return false;
  }

  if (trustedOrigin || trustedReferer) {
    return true;
  }

  res.status(403).json({ error: "Forbidden origin" });
  return false;
}

export function consumeRateLimit(req, options = {}) {
  const {
    bucket = "default",
    windowMs = 60_000,
    maxRequests = 5,
  } = options;

  const now = Date.now();
  const clientIp = getClientIp(req);
  const key = `${bucket}:${clientIp}`;
  const entry = RATE_LIMIT_STATE.get(key);

  for (const [currentKey, currentEntry] of RATE_LIMIT_STATE.entries()) {
    if (now - currentEntry.windowStart >= windowMs) {
      RATE_LIMIT_STATE.delete(currentKey);
    }
  }

  if (!entry || now - entry.windowStart >= windowMs) {
    RATE_LIMIT_STATE.set(key, {
      count: 1,
      windowStart: now,
    });

    return {
      limited: false,
      remaining: maxRequests - 1,
      retryAfter: 0,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      limited: true,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000)),
    };
  }

  entry.count += 1;

  return {
    limited: false,
    remaining: Math.max(0, maxRequests - entry.count),
    retryAfter: 0,
  };
}
