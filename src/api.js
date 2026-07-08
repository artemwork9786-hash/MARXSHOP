const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function createOrder(account) {
  return request("/api/rent", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function addAccount(account) {
  return request("/api/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  });
}
