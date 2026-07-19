const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
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

export async function uploadVideo(file) {
  // Step 1: Get presigned S3 URL from server (tiny request through tunnel)
  const presignRes = await fetch(`${API_URL}/api/presign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
