const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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
  const trustedOrigin = origin ? isTrustedUrl(origin, req, allowedOrigins) : false;
  const trustedReferer = referer ? isTrustedUrl(referer, req, allowedOrigins) : false;

  if (trustedOrigin || trustedReferer) {
    return true;
  }

  res.status(403).json({ error: "Forbidden origin" });
  return false;
}
