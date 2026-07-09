require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const storage = require("./lib/storage");
const cryptoPay = require("./lib/crypto-pay");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── JSON file-based storage for accounts ────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAccounts() {
  ensureDataDir();
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      console.log(`[DATA] products.json not found at ${PRODUCTS_FILE}, creating empty`);
      fs.writeFileSync(PRODUCTS_FILE, "[]", "utf-8");
      return [];
    }
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8");
    const accounts = JSON.parse(raw);
    console.log(`[DATA] Loaded ${accounts.length} accounts from ${PRODUCTS_FILE}`);
    return accounts;
  } catch (e) {
    console.error(`[DATA] Error loading ${PRODUCTS_FILE}:`, e.message);
    return [];
  }
}

function saveAccounts(accounts) {
  ensureDataDir();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
}

// ─── Static files — uploaded videos ──────────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "public", "uploads", "videos");
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
ensureUploadsDir();

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ─── Multer config ───────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadsDir();
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + ".mp4");
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "video/mp4") cb(null, true);
    else cb(new Error("Only .mp4 files allowed"), false);
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXCHANGE_RATES = { USD: 90, UAH: 2.4 };

function toRub(amount, fromCurrency) {
  if (fromCurrency === "RUB") return amount;
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) throw new Error(`Unsupported currency: ${fromCurrency}`);
  return Math.round(amount * rate);
}

// ─── CORS ────────────────────────────────────────────────────────────────────

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
        cb(null, true);
      }
    },
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});
app.use(express.json());

// ─── Accounts CRUD (JSON file-backed) ────────────────────────────────────────

app.get("/api/accounts", (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  const accounts = loadAccounts();
  res.json({ accounts });
});

app.post("/api/accounts", (req, res) => {
  const { title, price, status, description, tags, video_url, image_url } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const accounts = loadAccounts();
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
  saveAccounts(accounts);
  console.log(`[ADMIN] Account added: ${newAccount.title}`);
  res.status(201).json({ success: true, account: newAccount });
});

app.put("/api/accounts/:id", (req, res) => {
  const { id } = req.params;
  const accounts = loadAccounts();
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
  saveAccounts(accounts);
  console.log(`[ADMIN] Account updated: ${id}`);
  res.json({ success: true, account: accounts[idx] });
});

app.delete("/api/accounts/:id", (req, res) => {
  const { id } = req.params;
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Account not found" });

  accounts.splice(idx, 1);
  saveAccounts(accounts);
  console.log(`[ADMIN] Account deleted: ${id}`);
  res.json({ success: true, id });
});

// ─── Video upload ────────────────────────────────────────────────────────────

app.post("/api/upload-video", (req, res) => {
  upload.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const videoUrl = "/uploads/videos/" + req.file.filename;
    console.log(`[UPLOAD] Video: ${videoUrl}`);
    res.json({ video_url: videoUrl });
  });
});

// ─── Orders / Payments ───────────────────────────────────────────────────────

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

    const accounts = loadAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.status !== "В наличии") return res.status(409).json({ error: "Account is not available" });

    storage.reserveAccount(accountId, accounts);
    saveAccounts(accounts);

    const price = account.price;
    const order = storage.createOrder({ accountId, currency, method });

    if (method === "crypto") {
      const instructions = cryptoPay.getPayInstructions(order.id, price, currency);
      storage.updateOrder(order.id, { amount: price });
      console.log(`[ORDER] Crypto order created: ${order.id} for ${accountId}`);

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

app.get("/api/check-order", (req, res) => {
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "PENDING" && Date.now() > order.expiresAt) {
    storage.updateOrder(orderId, { status: "EXPIRED" });
    const accounts = loadAccounts();
    storage.releaseAccount(order.accountId, accounts);
    saveAccounts(accounts);
    return res.json({ orderId, status: "EXPIRED", paidAt: null });
  }

  res.json({
    orderId,
    status: order.status,
    paidAt: order.paidAt || null,
    credentials: order.status === "PAID" ? (() => {
      const accounts = loadAccounts();
      const account = accounts.find((a) => a.id === order.accountId);
      if (!account) return null;
      return {
        login: account.title.toLowerCase().replace(/ /g, "").replace(/#/g, "") + "@marx.shop",
        password: "marx" + account.id.slice(-3) + "2024!",
      };
    })() : null,
  });
});

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
      return res.json({ ok: true });
    }

    storage.updateOrder(order.id, { status: "PAID", paidAt: Date.now() });
    console.log(`[WEBHOOK] Order ${order.id} marked as PAID`);

    res.json({ ok: true });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

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

// ─── Exchange rates ──────────────────────────────────────────────────────────

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

// ─── Cancel order ────────────────────────────────────────────────────────────

app.post("/api/cancel-order", (req, res) => {
  const { accountId, orderId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = loadAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });

  storage.releaseAccount(accountId, accounts);
  saveAccounts(accounts);

  const pendingOrders = storage.getOrdersByAccountId(accountId);
  for (const o of pendingOrders) {
    if (o.status === "PENDING") {
      storage.updateOrder(o.id, { status: "EXPIRED" });
    }
  }

  console.log(`[ORDER] Cancelled for ${accountId}`);
  res.json({ success: true, accountId, status: "В наличии" });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  MARX SHOP API running on http://localhost:${PORT}\n`);
});
