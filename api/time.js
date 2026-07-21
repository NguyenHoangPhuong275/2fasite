import { applyCors, ensureTrustedBrowserRequest } from "./_security.js";

export default async function handler(req, res) {
  const { originTrusted } = applyCors(req, res, {
    methods: ["GET", "OPTIONS"],
    headers: ["Content-Type"],
  });
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return originTrusted ? res.status(204).end() : res.status(403).json({ error: "Forbidden origin" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ensureTrustedBrowserRequest(req, res)) {
    return;
  }

  return res.status(200).json({
    serverTime: Date.now(),
    iso: new Date().toISOString(),
  });
}
