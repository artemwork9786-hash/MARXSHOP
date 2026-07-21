const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getTelegramInitData() {
  try {
    const data = window.Telegram?.WebApp?.initData || "";
    if (!data) {
      console.warn("[TG] initData is empty. Telegram WebApp:", !!window.Telegram?.WebApp);
    }
    return data;
  } catch { return ""; }
}

async function request(path, options = {}) {
  const { headers: customHeaders, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getTelegramInitData(),
      ...customHeaders,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Accounts CRUD ───────────────────────────────────────────────────────────

export function getAccounts() {
  return request(`/api/accounts?_t=${Date.now()}`);
}

export function getRates() {
  return request(`/api/rates?_t=${Date.now()}`);
}

export function addAccount(account) {
  return request("/api/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function updateAccount(id, data) {
  return request(`/api/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAccount(id) {
  return request(`/api/accounts/${id}`, {
    method: "DELETE",
  });
}

export function payForAccount(accountId) {
  return request("/api/orders/pay", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function testPay(accountId) {
  return request("/api/orders/test-pay", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function getOrderStatus(accountId) {
  return request(`/api/orders/status/${accountId}`);
}

export function approveAccount(accountId) {
  return request("/api/orders/approve", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function confirmPayment(accountId) {
  return request("/api/orders/confirm-payment", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function rejectAccount(accountId) {
  return request("/api/orders/reject", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function getAdminOrders() {
  return request("/api/admin/orders");
}

export function getMyAccounts() {
  return request("/api/my-accounts");
}

export async function uploadVideo(file) {
  const presignRes = await fetch(`${API_URL}/api/presign-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getTelegramInitData(),
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4" }),
    cache: "no-store",
  });
  if (!presignRes.ok) throw new Error(`Presign error: ${presignRes.status}`);
  const { uploadUrl, publicUrl } = await presignRes.json();

  // Step 2: Upload directly to S3 (bypasses tunnel — goes straight to Yandex Cloud)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "video/mp4" },
  });
  if (!uploadRes.ok) throw new Error(`S3 upload error: ${uploadRes.status}`);

  return { video_url: publicUrl };
}

// ─── Orders / Payments ──────────────────────────────────────────────────────

export function createOrder({ accountId, currency, method, tgInitData, rentTerm, rentPrice }) {
  return request("/api/create-order", {
    method: "POST",
    body: JSON.stringify({ accountId, currency, method, tgInitData, rentTerm, rentPrice }),
  });
}

export function checkOrder(orderId) {
  return request(`/api/check-order?orderId=${orderId}&_t=${Date.now()}`);
}

export function confirmSbp(orderId) {
  return request("/api/confirm-sbp", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export function verifyInvoice(orderId, invoiceId) {
  return request("/api/verify-invoice", {
    method: "POST",
    body: JSON.stringify({ orderId, invoiceId }),
  });
}

export function cancelOrder(accountId) {
  return request("/api/cancel-order", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}

export function getConfig() {
  return request("/api/config");
}
