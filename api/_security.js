const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function getHeader(req, name) {
  const value = req.headers?.[name];
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  return new Set(
    String(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isTrustedUrl(value, req) {
  const url = parseUrl(value);
  const requestHost = (getHeader(req, "x-forwarded-host") || getHeader(req, "host")).toLowerCase();
  if (!url || !requestHost) return false;
  return url.host.toLowerCase() === requestHost
    || LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())
    || getAllowedOrigins().has(url.origin);
}

export function applyCors(req, res, options = {}) {
  const origin = getHeader(req, "origin");
  const originTrusted = Boolean(origin && isTrustedUrl(origin, req));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", (options.methods || ["GET", "OPTIONS"]).join(", "));
  res.setHeader("Access-Control-Allow-Headers", (options.headers || ["Content-Type"]).join(", "));
  if (originTrusted) res.setHeader("Access-Control-Allow-Origin", origin);
  return { originTrusted };
}

export function ensureTrustedBrowserRequest(req, res) {
  const origin = getHeader(req, "origin");
  const referer = getHeader(req, "referer");
  const secFetchSite = getHeader(req, "sec-fetch-site").toLowerCase();

  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    res.status(403).json({ error: "Forbidden origin" });
    return false;
  }

  if ((origin && isTrustedUrl(origin, req)) || (referer && isTrustedUrl(referer, req))) {
    return true;
  }

  res.status(403).json({ error: "Forbidden origin" });
  return false;
}
