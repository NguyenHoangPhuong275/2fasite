// Vercel Serverless Function - proxy token refresh to Microsoft Entra
// Browser calls same-origin /api/token, this function calls Microsoft server-side.

const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
