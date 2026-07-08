require("dotenv").config();
const express = require("express");
const cors = require("cors");
const storage = require("./lib/storage");
const cryptoPay = require("./lib/crypto-pay");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP";

// Fixed exchange rates for SBP conversion (MVP)
const EXCHANGE_RATES = { USD: 90, UAH: 2.4 };

function toRub(amount, fromCurrency) {
  if (fromCurrency === "RUB") return amount;
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) throw new Error(`Unsupported currency: ${fromCurrency}`);
  return Math.round(amount * rate);
}

// CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://artemwork9786-hash.github.io",
  "https://verykindandfriendlyguy.github.io",
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(null, true); // MVP
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// ─── Mock Accounts Data ───────────────────────────────────────────────────────

const accounts = [
  {
    id: "marx-vip-001",
    title: "MARX VIP #1",
    status: "available",
    skins: ["M416 Дракон", "Костюм Мумия", "AWM Космос"],
    prices: { rub: 23000, uah: 12400, usd: 280 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-002",
    title: "MARX VIP #2",
    status: "rented",
    skins: ["AKM Викинг", "УАЗ Тёмный Рыцарь", "Шлем Апокалипсиса"],
    prices: { rub: 18500, uah: 10000, usd: 225 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-003",
    title: "MARX VIP #3",
    status: "available",
    skins: ["Kar98k Снеговик", "Костюм Фантом", "M24 Золотой"],
    prices: { rub: 31000, uah: 16700, usd: 375 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-004",
    title: "MARX VIP #4",
    status: "available",
    skins: ["M416 Ледяной", "UMP45 Страж", "Джип Ниндзя"],
    prices: { rub: 15000, uah: 8100, usd: 182 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-005",
    title: "MARX VIP #5",
    status: "rented",
    skins: ["SCAR-L Пламя", "Костюм Дракон", "Дробовик Берсерк"],
    prices: { rub: 42000, uah: 22600, usd: 510 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-006",
    title: "MARX VIP #6",
    status: "available",
    skins: ["DP-28 Стальной", "Мотоцикл Ретро", "Очки Будущего"],
    prices: { rub: 12000, uah: 6500, usd: 146 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-007",
    title: "MARX VIP #7",
    status: "available",
    skins: ["AWM Фантом", "Костюм Тень", "Мотоцикл Гроза"],
    prices: { rub: 55000, uah: 29600, usd: 670 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-008",
    title: "MARX VIP #8",
    status: "available",
    skins: ["M16A4 Охотник", "UMP45 Механик", "Суперкары"],
    prices: { rub: 19500, uah: 10500, usd: 238 },
    video: "/sample-video.mp4",
  },
  {
    id: "marx-vip-009",
    title: "MARX LEGEND #1",
    status: "available",
    rank: "Завоеватель",
    skins: [
      "Золотой костюм",
      "Фулл гардероб",
      "X-Suit",
      "AWM Легенда",
      "M416 Ледяной Кристалл",
      "Костюм Тёмного Рыцаря",
      "Гарантия от восстановления",
    ],
    prices: { rub: 250000, uah: 130000, usd: 3000 },
    video: "/sample-video.mp4",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateTgInitData(initData) {
  if (!initData || typeof initData !== "string") return false;
  return initData.length > 0;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/accounts
app.get("/api/accounts", (_req, res) => {
  res.json({ accounts });
});

// POST /api/accounts — add a new account (admin)
app.post("/api/accounts", (req, res) => {
  const { id, title, status, skins, prices, video, rank } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const newAccount = {
    id: id || `marx-vip-${Date.now()}`,
    title,
    status: status || "available",
    rank: rank || null,
    skins: Array.isArray(skins) ? skins : [],
    prices: prices || { rub: 0, uah: 0, usd: 0 },
    video: video || "/sample-video.mp4",
  };
  accounts.push(newAccount);
  console.log(`[ADMIN] Account added: ${newAccount.title}`);
  res.status(201).json({ success: true, account: newAccount });
});

// POST /api/create-order — create a rental order (crypto or SBP)
app.post("/api/create-order", async (req, res) => {
  try {
    const { accountId, currency, method, tgInitData } = req.body;

    if (!accountId) return res.status(400).json({ error: "accountId is required" });
    if (!method || !["crypto", "sbp"].includes(method)) {
      return res.status(400).json({ error: "method must be 'crypto' or 'sbp'" });
    }
    if (!currency || !["RUB", "UAH", "USD"].includes(currency)) {
      return res.status(400).json({ error: "currency must be RUB, UAH, or USD" });
    }

    const account = accounts.find((a) => a.id === accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.status !== "available") return res.status(409).json({ error: "Account is not available" });

    // Reserve account
    storage.reserveAccount(accountId, accounts);

    const price = account.prices[currency.toLowerCase()];
    const order = storage.createOrder({ accountId, currency, method });

    if (method === "crypto") {
      // Create invoice via Crypto Pay API (fiat invoice)
      try {
        const { payUrl, invoiceId } = await cryptoPay.createInvoice({
          asset: "USDT",
          fiat: currency,
          amount: price,
          paid_btn_name: "callback",
          paid_btn_url: FRONTEND_URL,
          payload: order.id,
        });
        storage.updateOrder(order.id, { payUrl, invoiceId, amount: price });
        console.log(`[ORDER] Crypto invoice created: ${order.id} for ${accountId}`);

        return res.json({
          success: true,
          orderId: order.id,
          accountId,
          payUrl,
          amount: price,
          currency,
          expiresAt: order.expiresAt,
        });
      } catch (err) {
        console.error(`[CRYPTO_PAY] Error creating invoice:`, err.message);
        // Release account on failure
        storage.releaseAccount(accountId, accounts);
        storage.deleteOrder(order.id);
        return res.status(502).json({ error: "Failed to create crypto invoice" });
      }
    }

    // SBP method
    const amountRub = toRub(price, currency);
    const shortId = order.id.slice(-8).toUpperCase();
    const comment = `MARX-${shortId}`;

    storage.updateOrder(order.id, {
      amount: amountRub,
      paymentDetails: {
        recipientName: "Иванов И.И.",
        cardNumber: "2200 0000 0000 0000",
        bank: "Сбербанк",
        amount: amountRub,
        comment,
      },
    });

    console.log(`[ORDER] SBP order created: ${order.id} for ${accountId} — ${amountRub} RUB`);

    return res.json({
      success: true,
      orderId: order.id,
      accountId,
      paymentDetails: {
        recipientName: "Иванов И.И.",
        cardNumber: "2200 0000 0000 0000",
        bank: "Сбербанк",
        amount: amountRub,
        comment,
      },
      amount: amountRub,
      currency: "RUB",
      expiresAt: order.expiresAt,
    });
  } catch (err) {
    console.error("[CREATE-ORDER] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/check-order — check order status
app.get("/api/check-order", (req, res) => {
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // Check expiration
  if (order.status === "PENDING" && Date.now() > order.expiresAt) {
    storage.updateOrder(orderId, { status: "EXPIRED" });
    storage.releaseAccount(order.accountId, accounts);
    return res.json({ orderId, status: "EXPIRED", paidAt: null });
  }

  res.json({
    orderId,
    status: order.status,
    paidAt: order.paidAt || null,
  });
});

// POST /api/confirm-sbp — user clicks "I paid" for SBP
app.post("/api/confirm-sbp", (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.method !== "sbp") return res.status(400).json({ error: "Not an SBP order" });
  if (order.status !== "PENDING") return res.status(400).json({ error: `Order is ${order.status}` });

  storage.updateOrder(orderId, { status: "AWAITING_VERIFICATION" });
  console.log(`[ORDER] SBP confirmation: ${orderId} → AWAITING_VERIFICATION`);

  res.json({ success: true, orderId, status: "AWAITING_VERIFICATION" });
});

// POST /api/webhook/crypto — Crypto Bot webhook
app.post("/api/webhook/crypto", (req, res) => {
  try {
    const { update_type, payload } = req.body;
    console.log(`[WEBHOOK] Received: ${update_type}`);

    if (update_type !== "invoice_paid") {
      return res.json({ ok: true });
    }

    const invoiceId = String(payload.invoice_id);
    const order = storage.getOrderByInvoiceId(invoiceId);

    if (!order) {
      console.log(`[WEBHOOK] No order found for invoice ${invoiceId}`);
      return res.json({ ok: true });
    }

    if (order.status === "PAID") {
      return res.json({ ok: true }); // Already processed
    }

    storage.updateOrder(order.id, { status: "PAID", paidAt: Date.now() });
    console.log(`[WEBHOOK] Order ${order.id} marked as PAID`);

    res.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// POST /api/admin/verify-order — admin verifies SBP payment
app.post("/api/admin/verify-order", (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "AWAITING_VERIFICATION") {
    return res.status(400).json({ error: `Order is ${order.status}` });
  }

  storage.updateOrder(orderId, { status: "PAID", paidAt: Date.now() });
  console.log(`[ADMIN] Order ${orderId} verified → PAID`);

  res.json({ success: true, orderId, status: "PAID" });
});

// POST /api/cancel-order
app.post("/api/cancel-order", (req, res) => {
  const { accountId, orderId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });

  storage.releaseAccount(accountId, accounts);

  // Also expire any pending orders for this account
  const pendingOrders = storage.getOrdersByAccountId(accountId);
  for (const o of pendingOrders) {
    if (o.status === "PENDING") {
      storage.updateOrder(o.id, { status: "EXPIRED" });
    }
  }

  console.log(`[ORDER] Cancelled for ${accountId}`);
  res.json({ success: true, accountId, status: "available" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  MARX SHOP API running on http://localhost:${PORT}\n`);
});
