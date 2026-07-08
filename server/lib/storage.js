const crypto = require("crypto");

// In-memory order storage
const orders = new Map();

// Active account reservation timers: accountId -> timeoutId
const reservationTimers = new Map();

/**
 * Create a new order
 * @param {{ accountId, currency, method, userId? }} params
 * @returns {object} created order
 */
function createOrder({ accountId, currency, method, userId = null }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const order = {
    id,
    accountId,
    userId,
    currency,
    method, // "crypto" | "sbp"
    status: "PENDING",
    payUrl: null,
    paymentDetails: null,
    invoiceId: null,
    amount: 0,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,
  };
  orders.set(id, order);
  return order;
}

function getOrder(orderId) {
  return orders.get(orderId) || null;
}

function getOrdersByAccountId(accountId) {
  const result = [];
  for (const order of orders.values()) {
    if (order.accountId === accountId) result.push(order);
  }
  return result;
}

function getOrderByInvoiceId(invoiceId) {
  for (const order of orders.values()) {
    if (order.invoiceId === invoiceId) return order;
  }
  return null;
}

function updateOrder(orderId, updates) {
  const order = orders.get(orderId);
  if (!order) return null;
  Object.assign(order, updates);
  return order;
}

function deleteOrder(orderId) {
  orders.delete(orderId);
}

// Account reservation helpers
function reserveAccount(accountId, accounts) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account || account.status !== "В наличии") return false;
  account.status = "Занят";

  // Clear existing timer if any
  if (reservationTimers.has(accountId)) {
    clearTimeout(reservationTimers.get(accountId));
  }

  const timer = setTimeout(() => {
    account.status = "В наличии";
    reservationTimers.delete(accountId);
    // Also expire all pending orders for this account
    for (const order of orders.values()) {
      if (order.accountId === accountId && order.status === "PENDING") {
        order.status = "EXPIRED";
      }
    }
    console.log(`[TIMER] Reservation for ${accountId} expired`);
  }, 10 * 60 * 1000);

  reservationTimers.set(accountId, timer);
  return true;
}

function releaseAccount(accountId, accounts) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return;
  account.status = "В наличии";
  if (reservationTimers.has(accountId)) {
    clearTimeout(reservationTimers.get(accountId));
    reservationTimers.delete(accountId);
  }
}

module.exports = {
  createOrder,
  getOrder,
  getOrdersByAccountId,
  getOrderByInvoiceId,
  updateOrder,
  deleteOrder,
  reserveAccount,
  releaseAccount,
};
