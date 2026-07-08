const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function createOrder({ accountId, currency, method, tgInitData }) {
  return request("/api/create-order", {
    method: "POST",
    body: JSON.stringify({ accountId, currency, method, tgInitData }),
  });
}

export function checkOrder(orderId) {
  return request(`/api/check-order?orderId=${orderId}`);
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

export function addAccount(account) {
  return request("/api/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  });
}
