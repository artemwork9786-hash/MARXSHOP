require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const storage = require("./lib/storage");
const cryptoPay = require("./lib/crypto-pay");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP";

// Static files — uploaded videos
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Multer config
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "public/uploads/videos"),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + ".mp4");
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "video/mp4") cb(null, true);
    else cb(new Error("Only .mp4 files allowed"), false);
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

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

// ─── Accounts Data (new model) ────────────────────────────────────────────────

let accounts = [
  {
    id: "marx-vip-001", title: "MARX VIP #1", price: 23000,
    status: "В наличии", description: "Полный гардероб скинов, завоеватель, все оружие в легендарных скинах",
    tags: ["M416 Дракон", "Костюм Мумия", "AWM Космос"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-002", title: "MARX VIP #2", price: 18500,
    status: "Занят", description: "Аккаунт с редкими скинами транспорта и оружия",
    tags: ["AKM Викинг", "УАЗ Тёмный Рыцарь", "Шлем Апокалипсиса"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-003", title: "MARX VIP #3", price: 31000,
    status: "В наличии", description: "Снайперский аккаунт с лучшими винтовками",
    tags: ["Kar98k Снеговик", "Костюм Фантом", "M24 Золотой"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-004", title: "MARX VIP #4", price: 15000,
    status: "В наличии", description: "Аккаунт для любителей автоматов и пистолетов",
    tags: ["M416 Ледяной", "UMP45 Страж", "Джип Ниндзя"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-005", title: "MARX VIP #5", price: 42000,
    status: "Занят", description: "Премиум аккаунт с эксклюзивными костюмами",
    tags: ["SCAR-L Пламя", "Костюм Дракон", "Дробовик Берсерк"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-006", title: "MARX VIP #6", price: 12000,
    status: "В наличии", description: "Бюджетный аккаунт с хорошим набором скинов",
    tags: ["DP-28 Стальной", "Мотоцикл Ретро", "Очки Будущего"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-007", title: "MARX VIP #7", price: 55000,
    status: "В наличии", description: "Топовый аккаунт с X-Suit и полным гардеробом",
    tags: ["AWM Фантом", "Костюм Тень", "Мотоцикл Гроза"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-008", title: "MARX VIP #8", price: 19500,
    status: "В наличии", description: "Сбалансированный аккаунт для рейтинговых игр",
    tags: ["M16A4 Охотник", "UMP45 Механик", "Суперкары"],
    video_url: "", image_url: "/placeholder.svg",
  },
  {
    id: "marx-vip-009", title: "MARX LEGEND #1", price: 250000,
    status: "В наличии", description: "Легендарный аккаунт. Завоеватель. Фулл гардероб. X-Suit. Гарантия от восстановления.",
    tags: ["Золотой костюм", "Фулл гардероб", "X-Suit", "AWM Легенда", "M416 Ледяной Кристалл", "Костюм Тёмного Рыцаря"],
    video_url: "", image_url: "/placeholder.svg",
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
  const { title, price, status, description, tags, video_url, image_url } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const newAccount = {
    id: `marx-vip-${Date.now()}`,
    title,
    price: Number(price) || 0,
    status: status || "В наличии",
    description: description || "",
    tags: Array.isArray(tags) ? tags : [],
    video_url: video_url || "",
    image_url: image_url || "/placeholder.svg",
  };
  accounts.push(newAccount);
  console.log(`[ADMIN] Account added: ${newAccount.title}`);
  res.status(201).json({ success: true, account: newAccount });
});

// POST /api/upload-video — upload video file
app.post("/api/upload-video", (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const videoUrl = "/uploads/videos/" + req.file.filename;
    console.log(`[UPLOAD] Video: ${videoUrl}`);
    res.json({ video_url: videoUrl });
  });
});

// PUT /api/accounts/:id — update account (admin)
app.put("/api/accounts/:id", (req, res) => {
  const { id } = req.params;
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Account not found" });

  const { title, price, status, description, tags, video_url, image_url } = req.body;
  accounts[idx] = {
    ...accounts[idx],
    title: title !== undefined ? title : accounts[idx].title,
    price: price !== undefined ? Number(price) : accounts[idx].price,
    status: status !== undefined ? status : accounts[idx].status,
    description: description !== undefined ? description : accounts[idx].description,
    tags: tags !== undefined ? (Array.isArray(tags) ? tags : []) : accounts[idx].tags,
    video_url: video_url !== undefined ? video_url : accounts[idx].video_url,
    image_url: image_url !== undefined ? image_url : accounts[idx].image_url,
  };
  console.log(`[ADMIN] Account updated: ${id}`);
  res.json({ success: true, account: accounts[idx] });
});

// DELETE /api/accounts/:id — delete account (admin)
app.delete("/api/accounts/:id", (req, res) => {
  const { id } = req.params;
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Account not found" });

  accounts.splice(idx, 1);
  console.log(`[ADMIN] Account deleted: ${id}`);
  res.json({ success: true, id });
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
    if (account.status !== "В наличии") return res.status(409).json({ error: "Account is not available" });

    // Reserve account
    storage.reserveAccount(accountId, accounts);

    const price = account.price;
    const order = storage.createOrder({ accountId, currency, method });

    if (method === "crypto") {
      // Manual invoice flow — user creates invoice in @CryptoBot
      const instructions = cryptoPay.getPayInstructions(order.id, price, currency);
      storage.updateOrder(order.id, { amount: price });
      console.log(`[ORDER] Crypto order created: ${order.id} for ${accountId} — manual flow`);

      return res.json({
        success: true,
        orderId: order.id,
        accountId,
        method: "crypto",
        instructions,
        amount: price,
        currency,
        expiresAt: order.expiresAt,
      });
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
    credentials: order.status === "PAID" ? (() => {
      const account = accounts.find((a) => a.id === order.accountId);
      if (!account) return null;
      return {
        login: account.title.toLowerCase().replace(/ /g, "").replace(/#/g, "") + "@marx.shop",
        password: "marx" + account.id.slice(-3) + "2024!",
      };
    })() : null,
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

// POST /api/verify-invoice — user submits invoice_id from @CryptoBot
app.post("/api/verify-invoice", (req, res) => {
  const { orderId, invoiceId } = req.body;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });
  if (!invoiceId) return res.status(400).json({ error: "invoiceId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.method !== "crypto") return res.status(400).json({ error: "Not a crypto order" });
  if (order.status !== "PENDING") return res.status(400).json({ error: `Order is ${order.status}` });

  storage.updateOrder(orderId, {
    invoiceId: invoiceId,
    status: "AWAITING_VERIFICATION",
  });
  console.log(`[ORDER] Crypto invoice submitted: ${orderId}, invoice: ${invoiceId}`);

  res.json({
    success: true,
    orderId,
    invoiceId,
    status: "AWAITING_VERIFICATION",
    message: "Invoice ID получен. Ожидает подтверждения.",
  });
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

// GET /api/rates — exchange rates from Crypto Bot API (cached 10 min)
let ratesCache = null;
let ratesCacheTime = 0;

app.get("/api/rates", async (_req, res) => {
  const now = Date.now();
  if (ratesCache && now - ratesCacheTime < 10 * 60 * 1000) {
    return res.json(ratesCache);
  }

  try {
    const url = "https://" + "pay." + "crypto.bot" + "/api/getExchangeRates";
    const r = await fetch(url, {
      headers: { "Crypto-Pay-API-Token": process.env.CRYPTO_BOT_TOKEN || "" },
    });
    const data = await r.json();

    if (!data.ok) throw new Error("Crypto Pay API error");

    const rates = data.result || [];
    const findRate = (src, tgt) => {
      const item = rates.find((e) => e.source === src && e.target === tgt);
      return item ? item.rate : null;
    };

    const usdToRub = findRate("USDT", "RUB");
    const usdToUah = findRate("USDT", "UAH");

    const result = {
      usd_to_rub: usdToRub || 90,
      usd_to_uah: usdToUah || 41,
    };

    ratesCache = result;
    ratesCacheTime = now;
    console.log(`[RATES] Updated: USD/RUB=${result.usd_to_rub}, USD/UAH=${result.usd_to_uah}`);
    res.json(result);
  } catch (err) {
    console.error("[RATES] Error:", err.message);
    const fallback = { usd_to_rub: 90, usd_to_uah: 41 };
    res.json(fallback);
  }
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
  res.json({ success: true, accountId, status: "В наличии" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  MARX SHOP API running on http://localhost:${PORT}\n`);
});
