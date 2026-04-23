const TOKEN_ENDPOINT = "/api/token";
const GRAPH_MESSAGES_ENDPOINT = "https://graph.microsoft.com/v1.0/me/messages";
const REQUEST_TIMEOUT_MS = 15000;
const MESSAGE_LIMIT = 12;
const ACCESS_TOKEN_TTL_MS = 5 * 60 * 1000;
const GRAPH_SCOPE =
  "https://graph.microsoft.com/Mail.Read offline_access openid profile";

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REFRESH_TOKEN_PATTERN = /M\.[^\s|]+/g;
const VERIFICATION_CONTEXT_PATTERN =
  /\b(otp|passcode|verification|verify|verification code|security code|login code|auth(?:entication)?|one[-\s]*time|2fa|two[-\s]*factor|confirm(?:ation)? code|m[aã]\s*x[aá]c\s*minh|m[aã]|x[aá]c\s*minh)\b/i;
const CODE_HINT_PATTERN =
  /\b(otp|passcode|verification code|security code|login code|confirm(?:ation)? code|use code|enter (?:this )?code|code is|m[aã]\s*x[aá]c\s*minh|m[aã]\s+l[aà]\s+([A-Z0-9-]{4,10}))\b/i;
const LABELED_CODE_PATTERNS = [
  /\b(?:otp|passcode|verification code|security code|login code|confirm(?:ation)? code|m[aã]\s*x[aá]c\s*minh)\b[\s:>#-]{0,12}([A-Z0-9]{4,10}(?:-[A-Z0-9]{2,6})?)\b/i,
  /\bcode\s*(?:is|:|#|-)?\s*([A-Z0-9]{4,10}(?:-[A-Z0-9]{2,6})?)\b/i,
];
const DANGEROUS_HTML_SELECTOR =
  "script, iframe, object, embed, form, input, button, textarea, select, meta[http-equiv='refresh']";
const TEXT = {
  timeout: "Yêu cầu hết thời gian chờ (15s). Thử lại sau.",
  endpoint405:
    "Endpoint /api/token đang trả về 405. Hãy chạy app bằng npx vercel dev (không mở file HTML trực tiếp, không dùng Live Server).",
  aadsts:
    "AADSTS90023: App Entra chưa được cấu hình đúng cho luồng token hiện tại.",
  network:
    "Không thể kết nối endpoint Microsoft. Kiểm tra mạng, VPN/firewall hoặc CORS.",
  loadData: "Không thể tải dữ liệu.",
  senderUnknown: "Không rõ",
  subjectEmpty: "(Không tiêu đề)",
  timeUnknown: "Không rõ thời gian",
  detailDefaultTitle: "Nội dung thư",
  detailEmptyBody: "(Thư không có nội dung hiển thị.)",
  emailUnknown: "Không rõ email",
  copyTitle: "Bấm để sao chép",
  copied: "Đã sao chép",
  noToken: "Thiếu access token.",
  loadToken: "Không thể lấy access token.",
  missingClientId:
    "Missing Microsoft client_id. Add client_id:<uuid> to the pasted data or set MS_CLIENT_ID on the server.",
  legacyDeviceOnly:
    "Không tìm thấy Microsoft client_id hợp lệ trong dữ liệu đã dán.",
  noMessages: "Không thể tải danh sách thư.",
  loadingContent: "Đang tải nội dung thư...",
  loadedList: "Đã tải danh sách thư.",
  noMailData: "Không tìm thấy dữ liệu.",
  loading: "Đang đọc...",
  loadingList: "Đang đọc thư...",
  noNew: "Không có thư mới.",
  readMail: "Đọc thư",
};

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function requestJson(url, options = {}) {
  const timeout = withTimeout(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload.error_description === "string"
          ? payload.error_description
          : payload && typeof payload.error === "string"
            ? payload.error
            : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  } finally {
    timeout.done();
  }
}

function normalizeUiError(error) {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return TEXT.timeout;
  }

  const message = error instanceof Error ? error.message : String(error || "");
  if (message.toLowerCase().includes("aborted")) {
    return TEXT.timeout;
  }

  if (message === "HTTP 405") {
    return TEXT.endpoint405;
  }

  if (
    /AADSTS90023/i.test(message) ||
    /Cross-origin token redemption/i.test(message)
  ) {
    return TEXT.aadsts;
  }

  if (
    /client_id is required/i.test(message) ||
    /Invalid client_id format/i.test(message)
  ) {
    return TEXT.missingClientId;
  }

  if (
    /invalid_graph_access_token/i.test(message) ||
    /did not produce a Microsoft Graph Mail\.Read access token/i.test(message)
  ) {
    return "The provided refresh token is valid, but it does not issue a Microsoft Graph Mail.Read token for this client_id.";
  }

  if (message === "Failed to fetch" || message.includes("NetworkError")) {
    return TEXT.network;
  }

  return message || TEXT.loadData;
}

function uniqueIgnoreCase(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isEmail(value) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

function isRefreshToken(value) {
  return /^M\./.test(value);
}

function parsePastedCredentialPayload(rawValue) {
  const raw = String(rawValue || "").trim();
  const compact = raw.replace(/\s+/g, "");
  const segments = compact
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "none");

  let email = "";
  let refreshToken = "";
  let deviceId = "";
  let clientId = "";

  if (
    segments.length >= 4 &&
    isEmail(segments[0]) &&
    isRefreshToken(segments[2]) &&
    isUuid(segments[3])
  ) {
    email = segments[0];
    refreshToken = segments[2];
    clientId = segments[3];
  } else if (
    segments.length >= 3 &&
    isEmail(segments[0]) &&
    isRefreshToken(segments[1]) &&
    isUuid(segments[2])
  ) {
    email = segments[0];
    refreshToken = segments[1];
    clientId = segments[2];
  } else if (
    segments.length >= 2 &&
    isRefreshToken(segments[0]) &&
    isUuid(segments[1])
  ) {
    refreshToken = segments[0];
    clientId = segments[1];
  }

  if (!email) {
    const emailMatches = raw.match(EMAIL_PATTERN) || [];
    email = emailMatches[0] || "";
  }

  if (!refreshToken) {
    const tokenMatches = compact.match(REFRESH_TOKEN_PATTERN) || [];
    refreshToken = tokenMatches[0] || "";
  }

  const labeledClientMatch = raw.match(
    /(?:client[_\s-]*id|app[_\s-]*id|application[_\s-]*id)\s*[:=]\s*([0-9a-fA-F-]{36})/i,
  );
  if (labeledClientMatch && isUuid(labeledClientMatch[1])) {
    clientId = labeledClientMatch[1];
  }

  const labeledDeviceMatch = raw.match(
    /(?:device[_\s-]*id)\s*[:=]\s*([0-9a-fA-F-]{36})/i,
  );
  if (!deviceId && labeledDeviceMatch && isUuid(labeledDeviceMatch[1])) {
    deviceId = labeledDeviceMatch[1];
  }

  if (!clientId && deviceId) {
    clientId = deviceId;
  }

  const uuidMatches = uniqueIgnoreCase(raw.match(UUID_PATTERN) || []);
  if (!clientId && uuidMatches.length) {
    clientId = uuidMatches[0];
  }

  if (!deviceId && uuidMatches.length > 1) {
    deviceId = uuidMatches[uuidMatches.length - 1];
  }

  if (!clientId && deviceId && uuidMatches.length > 1) {
    clientId =
      uuidMatches.find(
        (value) => value.toLowerCase() !== deviceId.toLowerCase(),
      ) || "";
  }

  return {
    email,
    refreshToken,
    deviceId,
    clientId,
  };
}

function normalizeSender(message) {
  const sender = message?.Sender?.EmailAddress || message?.from?.emailAddress;

  return {
    name: sender?.Name || sender?.name || TEXT.senderUnknown,
    address: sender?.Address || sender?.address || TEXT.senderUnknown,
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .slice(0, MESSAGE_LIMIT)
    .map((message) => {
      const sender = normalizeSender(message || {});

      return {
        id: String(message?.Id || message?.id || ""),
        subject: String(
          message?.Subject || message?.subject || TEXT.subjectEmpty,
        ),
        receivedAt: String(
          message?.ReceivedDateTime || message?.receivedDateTime || "",
        ),
        preview: String(message?.BodyPreview || message?.bodyPreview || ""),
        senderName: sender.name,
        senderAddress: sender.address,
      };
    })
    .filter((message) => message.id);
}

function buildMessagesUrl(endpoint) {
  if (endpoint.includes("graph.microsoft.com")) {
    return `${endpoint}?$orderby=receivedDateTime%20desc&$top=${MESSAGE_LIMIT}&$select=id,subject,receivedDateTime,bodyPreview,from`;
  }

  return `${endpoint}?$orderby=ReceivedDateTime%20DESC&$top=${MESSAGE_LIMIT}`;
}

function formatDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return TEXT.timeUnknown;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getSenderLine(message) {
  if (
    message.senderName &&
    message.senderAddress &&
    message.senderName !== message.senderAddress
  ) {
    return `${message.senderName} <${message.senderAddress}>`;
  }

  return message.senderAddress || message.senderName || TEXT.senderUnknown;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getMessageContextText(message) {
  return normalizeWhitespace(`${message?.subject || ""} ${message?.preview || ""}`);
}

function isLikelyOtpToken(value) {
  const token = String(value || "").trim();
  if (!token) {
    return false;
  }

  if (!/^[A-Z0-9-]{4,12}$/i.test(token)) {
    return false;
  }

  return /\d/.test(token);
}

function extractOtpCodeFromText(text) {
  const combinedText = normalizeWhitespace(text);
  if (!combinedText || !VERIFICATION_CONTEXT_PATTERN.test(combinedText)) {
    return "";
  }

  for (const pattern of LABELED_CODE_PATTERNS) {
    const labeled = combinedText.match(pattern);
    if (labeled?.[1] && isLikelyOtpToken(labeled[1])) {
      return labeled[1];
    }
  }

  if (!CODE_HINT_PATTERN.test(combinedText)) {
    return "";
  }

  const dashed = combinedText.match(/\b[A-Z0-9]{2,4}-[A-Z0-9]{2,6}\b/);
  if (dashed && isLikelyOtpToken(dashed[0])) {
    return dashed[0];
  }

  const digits = combinedText.match(/\b\d{5,8}\b/);
  if (digits) {
    return digits[0];
  }

  return "";
}

function extractOtpCode(message) {
  return extractOtpCodeFromText(getMessageContextText(message));
}

function extractOtpCodeFromDetail(message, detail) {
  const detailText =
    detail?.contentType === "html"
      ? toPlainText(detail?.content || "")
      : normalizeWhitespace(detail?.content || "");

  return extractOtpCodeFromText(
    `${message?.subject || ""} ${message?.preview || ""} ${detailText}`,
  );
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toPlainText(rawContent) {
  const content = String(rawContent || "");
  const parsed = new DOMParser().parseFromString(content, "text/html");
  const text = parsed.body?.textContent || "";
  return text.replace(/\u00a0/g, " ").trim();
}

function normalizeDetailPayload(detail) {
  const body = detail?.Body || detail?.body || {};
  const rawContent =
    typeof body?.Content === "string"
      ? body.Content
      : typeof body?.content === "string"
        ? body.content
        : "";
  const rawContentType =
    typeof body?.ContentType === "string"
      ? body.ContentType
      : typeof body?.contentType === "string"
        ? body.contentType
        : "";

  return {
    content: rawContent,
    contentType: rawContentType.toLowerCase() === "html" ? "html" : "text",
  };
}

function sanitizeEmailHtml(rawContent) {
  const parsed = new DOMParser().parseFromString(
    String(rawContent || ""),
    "text/html",
  );

  parsed.querySelectorAll(DANGEROUS_HTML_SELECTOR).forEach((node) => {
    node.remove();
  });

  parsed.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        continue;
      }

      if (
        (name === "href" || name === "src" || name === "action") &&
        /^\s*javascript:/i.test(value)
      ) {
        node.removeAttribute(attribute.name);
      }
    }
  });

  const bodyMarkup = parsed.body?.innerHTML?.trim();
  if (!bodyMarkup) {
    return "";
  }

  return `<!doctype html><html><head><meta charset="UTF-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#111}body{padding:16px;font-family:Manrope,Segoe UI,system-ui,sans-serif;line-height:1.6;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap;word-break:break-word}</style>${parsed.head?.innerHTML || ""}</head><body>${bodyMarkup}</body></html>`;
}

function renderMessageIntoFrame(iframe, subject, detail) {
  const safeSubject = escapeHtml(subject || TEXT.detailDefaultTitle);
  const rawContent = detail?.content || "";
  const contentType = detail?.contentType || "text";

  if (contentType === "html") {
    const safeHtml = sanitizeEmailHtml(rawContent);
    if (safeHtml) {
      iframe.srcdoc = safeHtml.replace(
        "<head>",
        `<head><title>${safeSubject}</title>`,
      );
      return;
    }
  }

  const safeContent = escapeHtml(toPlainText(rawContent) || TEXT.detailEmptyBody);
  iframe.srcdoc = `<!doctype html><html><head><meta charset="UTF-8"><title>${safeSubject}</title><style>body{font-family:Manrope,Segoe UI,system-ui,sans-serif;padding:16px;line-height:1.6;color:#111}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${safeContent}</pre></body></html>`;
}

function getPreviewSnippet(message) {
  return normalizeWhitespace(message?.preview || "");
}

function applyMessageCodeState(rowElement, message) {
  const code = String(message?.otpCode || "").trim();
  const iconDiv = rowElement.querySelector(".outlook-item-icon");
  const badgeSpan = rowElement.querySelector(".outlook-item-badge");
  let codeDiv = rowElement.querySelector(".outlook-item-code");

  if (iconDiv) {
    const lowerSubject = String(message?.subject || "").toLowerCase();
    const lowerSender = String(message?.senderName || "").toLowerCase();

    if (code) {
      iconDiv.textContent = "OTP";
    } else if (lowerSubject.includes("gpt") || lowerSender.includes("gpt")) {
      iconDiv.textContent = "AI";
    } else if (lowerSubject.includes("premium") || lowerSender.includes("pro")) {
      iconDiv.textContent = "PRO";
    } else {
      iconDiv.textContent = "MAIL";
    }
  }

  if (badgeSpan) {
    badgeSpan.textContent = code || String(message?.listIndex || "");
    if (code) {
      badgeSpan.style.background = "";
      badgeSpan.style.color = "";
    } else {
      badgeSpan.style.background = "rgba(100, 116, 139, 0.2)";
      badgeSpan.style.color = "var(--slate-400)";
    }
  }

  if (code) {
    if (!codeDiv) {
      codeDiv = document.createElement("div");
      codeDiv.className = "outlook-item-code";
      codeDiv.title = TEXT.copyTitle;
      codeDiv.addEventListener("click", async (event) => {
        event.stopPropagation();
        const currentCode = String(message?.otpCode || "").trim();
        if (!currentCode) {
          return;
        }

        try {
          await navigator.clipboard.writeText(currentCode);
          codeDiv.textContent = TEXT.copied;
          codeDiv.classList.add("copied");

          setTimeout(() => {
            codeDiv.textContent = String(message?.otpCode || "").trim();
            codeDiv.classList.remove("copied");
          }, 1400);
        } catch {}
      });
      rowElement.appendChild(codeDiv);
    }

    codeDiv.textContent = code;
  } else if (codeDiv) {
    codeDiv.remove();
  }
}

function buildMessageItem(message, index, email, state, onExpand) {
  const item = document.createElement("div");
  item.className = "outlook-list-item";
  item.addEventListener("click", () => onExpand(item, message, state));

  message.listIndex = index;
  message.otpCode = extractOtpCode(message);

  const iconDiv = document.createElement("div");
  iconDiv.className = "outlook-item-icon";

  const contentDiv = document.createElement("div");
  contentDiv.className = "outlook-item-content";

  const titleRow = document.createElement("div");
  titleRow.className = "outlook-item-title-row";

  const titleSpan = document.createElement("span");
  titleSpan.className = "outlook-item-title";
  titleSpan.textContent = message.subject;

  const badgeSpan = document.createElement("span");
  badgeSpan.className = "outlook-item-badge";

  titleRow.append(titleSpan, badgeSpan);

  const subtitleDiv = document.createElement("div");
  subtitleDiv.className = "outlook-item-subtitle";
  subtitleDiv.textContent = `${getSenderLine(message)} - ${email || TEXT.emailUnknown}`;

  const previewText = getPreviewSnippet(message);
  const previewDiv = document.createElement("div");
  previewDiv.className = "outlook-item-preview";
  previewDiv.textContent = previewText || message.subject;

  contentDiv.append(titleRow, subtitleDiv, previewDiv);

  const timeDiv = document.createElement("div");
  timeDiv.className = "outlook-item-time";
  timeDiv.textContent = formatDate(message.receivedAt);

  item.append(iconDiv, contentDiv, timeDiv);
  applyMessageCodeState(item, message);

  return item;
}

export function initOutlookModal() {
  const navHomeBtn = document.getElementById("navHomeBtn");
  const nav2faBtn = document.getElementById("nav2faBtn");
  const mailBtn = document.getElementById("mailBtn");
  const pricingBtn = document.getElementById("pricingBtn");
  const viewHome = document.getElementById("viewHome");
  const view2fa = document.getElementById("view2fa");
  const viewOutlook = document.getElementById("viewOutlook");
  const viewPricing = document.getElementById("viewPricing");
  const siteHeader = document.querySelector(".site-header");

  const payloadInput = document.getElementById("mailPayload");
  const loadMailBtn = document.getElementById("loadMailBtn");
  const mailStatus = document.getElementById("mailStatus");
  const mailList = document.getElementById("mailList");

  const detailModal = document.getElementById("mailDetailModal");
  const detailTitle = document.getElementById("mailDetailTitle");
  const detailMeta = document.getElementById("mailDetailMeta");
  const detailFrame = document.getElementById("mailDetailFrame");
  const closeDetailBtn = document.getElementById("closeMailDetailBtn");

  if (!payloadInput || !loadMailBtn || !mailList) {
    return;
  }

  const state = {
    detailCache: new Map(),
    accessToken: "",
    messagesEndpoint: GRAPH_MESSAGES_ENDPOINT,
    isLoading: false,
    clearTimer: 0,
    async loadDetail(messageId) {
      if (!state.accessToken) {
        throw new Error(TEXT.noToken);
      }

      const detail = await requestJson(
        `${state.messagesEndpoint}/${encodeURIComponent(messageId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            Accept: "application/json",
          },
        },
      );
      return normalizeDetailPayload(detail);
    },
  };

  const syncHeaderOffset = () => {
    document.documentElement.style.setProperty(
      "--viewport-height",
      `${window.innerHeight}px`,
    );

    if (!siteHeader) {
      return;
    }

    const headerHeight = Math.ceil(siteHeader.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      "--header-offset",
      `${headerHeight}px`,
    );
  };

  const setFullViewMode = (enabled) => {
    document.body.classList.toggle("full-view-mode", enabled);
    if (enabled) {
      syncHeaderOffset();
    }
  };

  function setStatus(text, isError = false) {
    if (!mailStatus) {
      return;
    }

    mailStatus.textContent = text;
    mailStatus.classList.toggle("error", isError);
  }

  function clearList() {
    while (mailList.firstChild) {
      mailList.removeChild(mailList.firstChild);
    }
  }

  function setListNotice(text, isError = false) {
    clearList();
    const notice = document.createElement("div");
    notice.className = `mail-status${isError ? " error" : ""}`;
    notice.style.marginBottom = "0";
    notice.textContent = text;
    mailList.appendChild(notice);
  }

  function openDetailModal(message, content) {
    if (!detailModal || !detailTitle || !detailFrame) {
      return;
    }

    const subject = message?.subject || TEXT.detailDefaultTitle;
    detailTitle.textContent = subject;

    if (detailMeta) {
      const sender = getSenderLine(message || {});
      const receivedAt = formatDate(message?.receivedAt || "");
      detailMeta.textContent = `${sender} - ${receivedAt}`;
    }

    renderMessageIntoFrame(detailFrame, subject, content);
    detailModal.classList.add("active");
  }

  function closeDetailModal() {
    if (!detailModal) {
      return;
    }

    detailModal.classList.remove("active");
    if (detailMeta) {
      detailMeta.textContent = "";
    }

    if (detailFrame) {
      detailFrame.srcdoc = "";
    }
  }

  function clearSensitiveState() {
    state.accessToken = "";
    state.detailCache.clear();

    if (state.clearTimer) {
      window.clearTimeout(state.clearTimer);
      state.clearTimer = 0;
    }
  }

  function scheduleSensitiveStateClear() {
    if (state.clearTimer) {
      window.clearTimeout(state.clearTimer);
    }

    state.clearTimer = window.setTimeout(() => {
      clearSensitiveState();
    }, ACCESS_TOKEN_TTL_MS);
  }

  async function getAccessToken(clientId, refreshToken) {
    if (!clientId) {
      throw new Error(TEXT.missingClientId);
    }

    const requestBody = {
      refresh_token: refreshToken,
      client_id: clientId,
    };

    const payload = await requestJson(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const accessToken =
      typeof payload?.access_token === "string"
        ? payload.access_token.trim()
        : "";
    if (!accessToken) {
      throw new Error(TEXT.loadToken);
    }

    return {
      accessToken,
      scope: typeof payload?.scope === "string" ? payload.scope : "",
    };
  }

  async function fetchMessagesByEndpoint(accessToken, endpoint) {
    return requestJson(buildMessagesUrl(endpoint), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  }

  async function fetchMessages(accessToken, targetEndpoint) {
    const payload = await fetchMessagesByEndpoint(
      accessToken,
      targetEndpoint,
    );
    return {
      endpoint: targetEndpoint,
      payload,
    };
  }

  async function handleExpandMessage(rowElement, message, currentState) {
    try {
      for (const node of mailList.querySelectorAll(
        ".outlook-list-item.selected",
      )) {
        node.classList.remove("selected");
      }
      rowElement.classList.add("selected");

      let detailContent = "";
      if (currentState.detailCache.has(message.id)) {
        detailContent = currentState.detailCache.get(message.id);
      } else {
        setStatus(TEXT.loadingContent);
        detailContent = await currentState.loadDetail(message.id);
        currentState.detailCache.set(message.id, detailContent);
      }

      if (!message.otpCode) {
        const detailCode = extractOtpCodeFromDetail(message, detailContent);
        if (detailCode) {
          message.otpCode = detailCode;
          applyMessageCodeState(rowElement, message);
        }
      }

      openDetailModal(message, detailContent);
      setStatus(TEXT.loadedList);
    } catch (error) {
      setStatus(normalizeUiError(error), true);
    }
  }

  async function loadMessages() {
    if (state.isLoading) {
      return;
    }

    const parsed = parsePastedCredentialPayload(payloadInput.value);
    if (!parsed.refreshToken) {
      const message = TEXT.noMailData;
      setStatus("");
      setListNotice(message, true);
      return;
    }

    if (!parsed.clientId) {
      const message = parsed.deviceId
        ? TEXT.legacyDeviceOnly
        : TEXT.missingClientId;
      setStatus("");
      setListNotice(message, true);
      return;
    }

    clearSensitiveState();

    state.isLoading = true;
    loadMailBtn.disabled = true;
    loadMailBtn.textContent = TEXT.loading;
    setListNotice(TEXT.loadingList);
    setStatus("");

    try {
      const tokenData = await getAccessToken(
        parsed.clientId,
        parsed.refreshToken,
      );
      state.accessToken = tokenData.accessToken;
      parsed.refreshToken = "";
      scheduleSensitiveStateClear();

      const scopeLower = tokenData.scope.toLowerCase();
      let fetchEndpoint = GRAPH_MESSAGES_ENDPOINT;
      if (scopeLower.includes("outlook.office.com")) {
        fetchEndpoint = "https://outlook.office.com/api/v2.0/me/messages";
      }

      const { endpoint, payload } = await fetchMessages(state.accessToken, fetchEndpoint);
      state.messagesEndpoint = endpoint;

      const messages = normalizeMessages(payload?.value || []);
      if (!messages.length) {
        const message = TEXT.noNew;
        setStatus("");
        setListNotice(message);
        return;
      }

      clearList();
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < messages.length; i += 1) {
        fragment.appendChild(
          buildMessageItem(
            messages[i],
            i + 1,
            parsed.email,
            state,
            handleExpandMessage,
          ),
        );
      }

      mailList.appendChild(fragment);
      setStatus(`Đã tải ${messages.length} thư.`);
    } catch (error) {
      clearSensitiveState();
      const message = normalizeUiError(error);
      setStatus("");
      setListNotice(message, true);
    } finally {
      state.isLoading = false;
      loadMailBtn.disabled = false;
      loadMailBtn.textContent = TEXT.readMail;
    }
  }

  let setActiveView = null;

  if (
    nav2faBtn &&
    mailBtn &&
    pricingBtn &&
    view2fa &&
    viewOutlook &&
    viewPricing
  ) {
    setActiveView = (nextView) => {
      setFullViewMode(nextView === "outlook");
      document.body.classList.toggle(
        "pricing-view-mode",
        nextView === "pricing",
      );
      document.body.classList.toggle("twofa-view-mode", nextView === "2fa");
      if (nextView === "pricing") {
        syncHeaderOffset();
      }

      if (navHomeBtn) {
        navHomeBtn.classList.remove("active");
      }
      nav2faBtn.classList.remove("active");
      mailBtn.classList.remove("active");
      pricingBtn.classList.remove("active");

      if (viewHome) {
        viewHome.style.display = "none";
      }
      view2fa.style.display = "none";
      viewOutlook.style.display = "none";
      viewPricing.style.display = "none";

      if (nextView === "home" && navHomeBtn && viewHome) {
        navHomeBtn.classList.add("active");
        viewHome.style.display = "";
        return;
      }

      if (nextView === "2fa") {
        nav2faBtn.classList.add("active");
        view2fa.style.display = "";
        return;
      }

      if (nextView === "outlook") {
        mailBtn.classList.add("active");
        viewOutlook.style.display = "flex";
        return;
      }

      pricingBtn.classList.add("active");
      viewPricing.style.display = "flex";
    };

    if (navHomeBtn && viewHome) {
      navHomeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveView("home");
      });
    }

    nav2faBtn.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView("2fa");
    });

    mailBtn.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView("outlook");
    });

    pricingBtn.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView("pricing");
    });
  }

  const quickViewTriggers = document.querySelectorAll("[data-go-view]");
  quickViewTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (!setActiveView) {
        return;
      }

      const view = trigger.getAttribute("data-go-view");
      if (!view) {
        return;
      }

      event.preventDefault();
      setActiveView(view);
    });
  });

  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", closeDetailModal);
  }

  if (detailModal) {
    detailModal.addEventListener("click", (event) => {
      if (event.target === detailModal) {
        closeDetailModal();
      }
    });
  }

  loadMailBtn.addEventListener("click", () => {
    void loadMessages();
  });

  const mailForm = payloadInput.closest("form");
  if (mailForm) {
    mailForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  }

  syncHeaderOffset();
  window.addEventListener("resize", syncHeaderOffset);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncHeaderOffset);
  }
}
