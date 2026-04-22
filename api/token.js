import { applyCors, consumeRateLimit, ensureTrustedBrowserRequest } from "./_security.js";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESH_TOKEN_MAX_LENGTH = 5000;
const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/Mail.Read offline_access openid profile";

function validateTokenRequest(body) {
  const { client_id, refresh_token, scope } = body || {};
  const normalizedClientId = typeof client_id === "string" ? client_id.trim() : client_id;
  const normalizedScope = typeof scope === "string" ? scope.trim() : "";

  if (typeof refresh_token !== "string" || !refresh_token.trim()) {
    return "refresh_token is required";
  }

  if (!refresh_token.startsWith("M.")) {
    return "Invalid refresh_token format";
  }

  if (refresh_token.length > REFRESH_TOKEN_MAX_LENGTH) {
    return "refresh_token is too long";
  }

  if (normalizedClientId !== undefined && normalizedClientId !== "") {
    if (typeof normalizedClientId !== "string" || !UUID_PATTERN.test(normalizedClientId)) {
      return "Invalid client_id format";
    }
  }

  if (normalizedScope && normalizedScope.length > 500) {
    return "scope is too long";
  }

  return "";
}

function sanitizeErrorDescription(value) {
  const message = String(value || "").trim();
  if (!message) {
    return "Authentication failed";
  }

  return message
    .replace(/Trace ID:\s*[^.\n]+\.?/gi, "")
    .replace(/Correlation ID:\s*[^.\n]+\.?/gi, "")
    .replace(/Timestamp:\s*[^.\n]+\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  const value = String(token || "").trim();
  const segments = value.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function hasRequiredGraphMailScope(payload) {
  const scopeValue = String(payload?.scp || "").trim();
  if (!scopeValue) {
    return false;
  }

  return scopeValue.split(/\s+/).includes("Mail.Read");
}

export default async function handler(req, res) {
  const { originTrusted } = applyCors(req, res, {
    methods: ["POST", "OPTIONS"],
    headers: ["Content-Type"],
  });
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return originTrusted ? res.status(204).end() : res.status(403).json({ error: "Forbidden origin" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ensureTrustedBrowserRequest(req, res)) {
    return;
  }

  const rateLimit = consumeRateLimit(req, {
    bucket: "token",
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (rateLimit.limited) {
    res.setHeader("Retry-After", String(rateLimit.retryAfter));
    return res.status(429).json({ error: "Too many requests" });
  }

  const validationError = validateTokenRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { client_id, refresh_token, scope } = req.body || {};
  const resolvedClientId = String(client_id || process.env.MS_CLIENT_ID || "").trim();
  const resolvedScope = String(scope || process.env.MS_GRAPH_SCOPE || DEFAULT_GRAPH_SCOPE).trim();

  if (!resolvedClientId) {
    return res.status(400).json({ error: "client_id is required" });
  }

  const body = new URLSearchParams({
    client_id: resolvedClientId,
    refresh_token,
    grant_type: "refresh_token",
    scope: resolvedScope,
  });

  try {
    const response = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      return res.status(response.status).json({
        error: String(data?.error || "token_exchange_failed"),
        error_description: sanitizeErrorDescription(data?.error_description),
      });
    }

    if (typeof data?.access_token !== "string" || !data.access_token.trim()) {
      return res.status(502).json({ error: "Invalid upstream response" });
    }

    const tokenPayload = decodeJwtPayload(data.access_token);
    const tokenAudience = String(tokenPayload?.aud || "").trim().toLowerCase();
    const isGraphAudience = tokenAudience === "https://graph.microsoft.com" || tokenAudience === "00000003-0000-0000-c000-000000000000";

    if (tokenPayload && (!isGraphAudience || !hasRequiredGraphMailScope(tokenPayload))) {
      return res.status(403).json({
        error: "invalid_graph_access_token",
        error_description: "The refresh token did not produce a Microsoft Graph Mail.Read access token for the configured client_id.",
      });
    }

    return res.status(200).json({
      access_token: String(data?.access_token || ""),
      expires_in: Number(data?.expires_in || 0),
      token_type: String(data?.token_type || "Bearer"),
    });
  } catch {
    return res.status(502).json({ error: "Upstream service unavailable" });
  }
}
