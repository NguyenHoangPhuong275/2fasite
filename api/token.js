import { applyCors, ensureTrustedBrowserRequest } from "./_security.js";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

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

  const { client_id, refresh_token } = req.body || {};
  const resolvedClientId = String(client_id || process.env.MS_CLIENT_ID || "").trim();

  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token is required" });
  }

  if (!resolvedClientId) {
    return res.status(400).json({ error: "client_id is required (or set MS_CLIENT_ID on server)" });
  }

  const body = new URLSearchParams({
    client_id: resolvedClientId,
    refresh_token,
    grant_type: "refresh_token",
  });

  try {
    const response = await fetch(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Microsoft token endpoint", detail: err.message });
  }
}
