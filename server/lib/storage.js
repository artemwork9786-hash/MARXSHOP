const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadOrders() {
  ensureDataDir();
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  ensureDataDir();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

// Active account reservation timers: accountId -> timeoutId
const reservationTimers = new Map();

function createOrder({ accountId, currency, method, userId = null }) {
  const orders = loadOrders();
  const id = crypto.randomUUID();
  const now = Date.now();
  const order = {
    id,
    accountId,
    userId,
    currency,
    method,
    status: "PENDING",
    payUrl: null,
    paymentDetails: null,
    invoiceId: null,
    amount: 0,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,
  };
  orders.push(order);
  saveOrders(orders);
  return order;
}

function getOrder(orderId) {
  const orders = loadOrders();
  return orders.find((o) => o.id === orderId) || null;
}

function getOrdersByAccountId(accountId) {
  return loadOrders().filter((o) => o.accountId === accountId);
}

function getOrderByInvoiceId(invoiceId) {
  return loadOrders().find((o) => o.invoiceId === invoiceId) || null;
}

function updateOrder(orderId, updates) {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  Object.assign(orders[idx], updates);
  saveOrders(orders);
  return orders[idx];
}

function deleteOrder(orderId) {
  const orders = loadOrders();
  const filtered = orders.filter((o) => o.id !== orderId);
  saveOrders(filtered);
}

// Account reservation helpers
function reserveAccount(accountId, accounts) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account || account.status !== "В наличии") return false;
  account.status = "Занят";

  if (reservationTimers.has(accountId)) {
    clearTimeout(reservationTimers.get(accountId));
  }

  const timer = setTimeout(() => {
    account.status = "В наличии";
    reservationTimers.delete(accountId);
    const orders = loadOrders();
    for (const order of orders) {
      if (order.accountId === accountId && order.status === "PENDING") {
        order.status = "EXPIRED";
      }
    }
    saveOrders(orders);
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
