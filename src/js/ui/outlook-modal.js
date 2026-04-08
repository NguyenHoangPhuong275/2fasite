const TOKEN_ENDPOINT = "/api/token";
const OUTLOOK_MESSAGES_ENDPOINT = "https://outlook.office.com/api/v2.0/me/messages";
const GRAPH_MESSAGES_ENDPOINT = "https://graph.microsoft.com/v1.0/me/messages";
const REQUEST_TIMEOUT_MS = 15000;
const MESSAGE_LIMIT = 12;

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REFRESH_TOKEN_PATTERN = /M\.[^\s|]+/g;
const TEXT = {
  timeout: "Yêu cầu hết thời gian chờ (15s). Thử lại sau.",
  endpoint405:
    "Endpoint /api/token đang trả về 405. Hãy chạy app bằng npx vercel dev (không mở file HTML trực tiếp, không dùng Live Server).",
  aadsts: "AADSTS90023: App Entra chưa được cấu hình đúng cho luồng token hiện tại.",
  network: "Không thể kết nối endpoint Microsoft. Kiểm tra mạng, VPN/firewall hoặc CORS.",
  loadData: "Không thể tải dữ liệu.",
  senderUnknown: "Không rõ",
  subjectEmpty: "(Không tiêu đề)",
  timeUnknown: "Không rõ thời gian",
  detailDefaultTitle: "Nội dung thư",
  detailEmptyBody: "(Thư không có nội dung hiển thị.)",
  emailUnknown: "Không rõ email",
  copyTitle: "Click để copy",
  copied: "Copied",
  noToken: "Thiếu access token.",
  loadToken: "Không thể lấy access token.",
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
      const message = payload && typeof payload.error_description === "string"
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
  if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
    return TEXT.timeout;
  }

  const message = error instanceof Error ? error.message : String(error || "");
  if (message.toLowerCase().includes("aborted")) {
    return TEXT.timeout;
  }

  if (message === "HTTP 405") {
    return TEXT.endpoint405;
  }

  if (/AADSTS90023/i.test(message) || /Cross-origin token redemption/i.test(message)) {
    return TEXT.aadsts;
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
    .filter(Boolean);

  let email = "";
  let refreshToken = "";
  let deviceId = "";
  let clientId = "";

  if (segments.length >= 4 && isEmail(segments[0]) && isRefreshToken(segments[2]) && isUuid(segments[3])) {
    email = segments[0];
    refreshToken = segments[2];
    deviceId = segments[3];
  } else if (segments.length >= 3 && isEmail(segments[0]) && isRefreshToken(segments[1]) && isUuid(segments[2])) {
    email = segments[0];
    refreshToken = segments[1];
    deviceId = segments[2];
  } else if (segments.length >= 2 && isRefreshToken(segments[0]) && isUuid(segments[1])) {
    refreshToken = segments[0];
    deviceId = segments[1];
  }

  if (!email) {
    const emailMatches = raw.match(EMAIL_PATTERN) || [];
    email = emailMatches[0] || "";
  }

  if (!refreshToken) {
    const tokenMatches = compact.match(REFRESH_TOKEN_PATTERN) || [];
    refreshToken = tokenMatches[0] || "";
  }

  const labeledDeviceMatch = raw.match(/(?:device[_\s-]*id)\s*[:=]\s*([0-9a-fA-F-]{36})/i);
  if (!deviceId && labeledDeviceMatch && isUuid(labeledDeviceMatch[1])) {
    deviceId = labeledDeviceMatch[1];
  }

  const labeledClientMatch = raw.match(/(?:client[_\s-]*id|app[_\s-]*id|application[_\s-]*id)\s*[:=]\s*([0-9a-fA-F-]{36})/i);
  if (labeledClientMatch && isUuid(labeledClientMatch[1])) {
    clientId = labeledClientMatch[1];
  }

  const uuidMatches = uniqueIgnoreCase(raw.match(UUID_PATTERN) || []);
  if (!deviceId && uuidMatches.length) {
    deviceId = uuidMatches[uuidMatches.length - 1];
  }

  if (!clientId && uuidMatches.length > 1) {
    clientId = uuidMatches.find((value) => value.toLowerCase() !== deviceId.toLowerCase()) || "";
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

  return messages.slice(0, MESSAGE_LIMIT).map((message) => {
    const sender = normalizeSender(message || {});

    return {
      id: String(message?.Id || message?.id || ""),
      subject: String(message?.Subject || message?.subject || TEXT.subjectEmpty),
      receivedAt: String(message?.ReceivedDateTime || message?.receivedDateTime || ""),
      preview: String(message?.BodyPreview || message?.bodyPreview || ""),
      senderName: sender.name,
      senderAddress: sender.address,
    };
  }).filter((message) => message.id);
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
  if (message.senderName && message.senderAddress && message.senderName !== message.senderAddress) {
    return `${message.senderName} <${message.senderAddress}>`;
  }

  return message.senderAddress || message.senderName || TEXT.senderUnknown;
}

function extractOtpCode(message) {
  const combinedText = `${message.subject} ${message.preview}`;

  const dashed = combinedText.match(/\b[A-Z0-9]{2,4}-[A-Z0-9]{2,6}\b/);
  if (dashed) {
    return dashed[0];
  }

  const digits = combinedText.match(/\b\d{5,8}\b/);
  if (digits) {
    return digits[0];
  }

  return "";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMessageIntoFrame(iframe, subject, rawContent) {
  const doc = iframe.contentWindow.document;
  const content = String(rawContent || "");
  const looksLikeHtml = /<\/?(html|body|div|table|p|span|br|a|h\d)\b/i.test(content);

  doc.open();

  if (looksLikeHtml) {
    doc.write(content);
  } else {
    const safeSubject = escapeHtml(subject || TEXT.detailDefaultTitle);
    const safeContent = escapeHtml(content || TEXT.detailEmptyBody);
    doc.write(`<!doctype html><html><head><meta charset="UTF-8"><title>${safeSubject}</title><style>body{font-family:Inter,Segoe UI,system-ui,sans-serif;padding:16px;line-height:1.6;color:#111}pre{white-space:pre-wrap;word-break:break-word}</style></head><body><pre>${safeContent}</pre></body></html>`);
  }

  doc.close();
}

function buildMessageItem(message, index, email, state, onExpand) {
  const item = document.createElement("div");
  item.className = "outlook-list-item";
  item.addEventListener("click", () => onExpand(item, message, state));

  const code = extractOtpCode(message);

  const iconDiv = document.createElement("div");
  iconDiv.className = "outlook-item-icon";

  const lowerSubject = message.subject.toLowerCase();
  const lowerSender = message.senderName.toLowerCase();
  if (code) {
    iconDiv.textContent = "OTP";
  } else if (lowerSubject.includes("gpt") || lowerSender.includes("gpt")) {
    iconDiv.textContent = "AI";
  } else if (lowerSubject.includes("premium") || lowerSubject.includes("pro")) {
    iconDiv.textContent = "PRO";
  } else {
    iconDiv.textContent = "MAIL";
  }

  const contentDiv = document.createElement("div");
  contentDiv.className = "outlook-item-content";

  const titleRow = document.createElement("div");
  titleRow.className = "outlook-item-title-row";

  const titleSpan = document.createElement("span");
  titleSpan.className = "outlook-item-title";
  titleSpan.textContent = message.subject;

  const badgeSpan = document.createElement("span");
  badgeSpan.className = "outlook-item-badge";
  badgeSpan.textContent = code || String(index);
  if (!code) {
    badgeSpan.style.background = "rgba(100, 116, 139, 0.2)";
    badgeSpan.style.color = "var(--slate-400)";
  }

  titleRow.append(titleSpan, badgeSpan);

  const subtitleDiv = document.createElement("div");
  subtitleDiv.className = "outlook-item-subtitle";
  subtitleDiv.textContent = `${getSenderLine(message)} - ${email || TEXT.emailUnknown}`;

  contentDiv.append(titleRow, subtitleDiv);

  const timeDiv = document.createElement("div");
  timeDiv.className = "outlook-item-time";
  timeDiv.textContent = formatDate(message.receivedAt);

  item.append(iconDiv, contentDiv, timeDiv);

  if (code) {
    const codeDiv = document.createElement("div");
    codeDiv.className = "outlook-item-code";
    codeDiv.textContent = code;
    codeDiv.title = TEXT.copyTitle;

    codeDiv.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
        codeDiv.textContent = TEXT.copied;
        codeDiv.classList.add("copied");

        setTimeout(() => {
          codeDiv.textContent = code;
          codeDiv.classList.remove("copied");
        }, 1400);
      } catch {
      }
    });

    item.appendChild(codeDiv);
  }

  return item;
}

export function initOutlookModal() {
  const nav2faBtn = document.getElementById("nav2faBtn");
  const mailBtn = document.getElementById("mailBtn");
  const pricingBtn = document.getElementById("pricingBtn");
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
    messagesEndpoint: OUTLOOK_MESSAGES_ENDPOINT,
    isLoading: false,
    async loadDetail(messageId) {
      if (!state.accessToken) {
        throw new Error(TEXT.noToken);
      }

      const detail = await requestJson(`${state.messagesEndpoint}/${encodeURIComponent(messageId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          Accept: "application/json",
        },
      });

      if (typeof detail?.Body?.Content === "string") {
        return detail.Body.Content;
      }

      if (typeof detail?.body?.content === "string") {
        return detail.body.content;
      }

      return "";
    },
  };

  const syncHeaderOffset = () => {
    document.documentElement.style.setProperty("--viewport-height", `${window.innerHeight}px`);

    if (!siteHeader) {
      return;
    }

    const headerHeight = Math.ceil(siteHeader.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-offset", `${headerHeight}px`);
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
      detailFrame.src = "about:blank";
    }
  }

  async function getAccessToken(clientId, refreshToken) {
    const payload = await requestJson(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });

    const accessToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
    if (!accessToken) {
      throw new Error(TEXT.loadToken);
    }

    return accessToken;
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

  async function fetchMessagesWithFallback(accessToken) {
    const endpoints = [OUTLOOK_MESSAGES_ENDPOINT, GRAPH_MESSAGES_ENDPOINT];
    let firstError = null;

    for (const endpoint of endpoints) {
      try {
        const payload = await fetchMessagesByEndpoint(accessToken, endpoint);
        return { endpoint, payload };
      } catch (error) {
        if (!firstError) {
          firstError = error;
        }
      }
    }

    throw firstError || new Error(TEXT.noMessages);
  }

  async function handleExpandMessage(rowElement, message, currentState) {
    try {
      for (const node of mailList.querySelectorAll(".outlook-list-item.selected")) {
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
      setStatus(message, true);
      setListNotice(message, true);
      return;
    }

    state.isLoading = true;
    loadMailBtn.disabled = true;
    loadMailBtn.textContent = TEXT.loading;
    setListNotice(TEXT.loadingList);
    setStatus("");

    try {
      state.accessToken = await getAccessToken(parsed.clientId || parsed.deviceId || "", parsed.refreshToken);

      const { endpoint, payload } = await fetchMessagesWithFallback(state.accessToken);
      state.messagesEndpoint = endpoint;

      const messages = normalizeMessages(payload?.value || []);
      if (!messages.length) {
        const message = TEXT.noNew;
        setStatus(message);
        setListNotice(message);
        return;
      }

      state.detailCache.clear();
      clearList();
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < messages.length; i += 1) {
        fragment.appendChild(buildMessageItem(messages[i], i + 1, parsed.email, state, handleExpandMessage));
      }

      mailList.appendChild(fragment);
      setStatus(`Đã tải ${messages.length} thư.`);
    } catch (error) {
      const message = normalizeUiError(error);
      setStatus(message, true);
      setListNotice(message, true);
    } finally {
      state.isLoading = false;
      loadMailBtn.disabled = false;
      loadMailBtn.textContent = TEXT.readMail;
    }
  }

  if (nav2faBtn && mailBtn && pricingBtn && view2fa && viewOutlook && viewPricing) {
    const setActiveView = (nextView) => {
      setFullViewMode(nextView === "outlook" || nextView === "pricing");
      document.body.classList.toggle("pricing-view-mode", nextView === "pricing");

      nav2faBtn.classList.remove("active");
      mailBtn.classList.remove("active");
      pricingBtn.classList.remove("active");

      view2fa.style.display = "none";
      viewOutlook.style.display = "none";
      viewPricing.style.display = "none";

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

  syncHeaderOffset();
  window.addEventListener("resize", syncHeaderOffset);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncHeaderOffset);
  }
}
