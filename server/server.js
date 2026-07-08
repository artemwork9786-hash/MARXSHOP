require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — разрешаем фронт из Telegram WebApp и GitHub Pages
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://verykindandfriendlyguy.github.io",
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(null, true); // MVP —开放所有， продакшен сузить
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
      "Гарантия от восстановления 🔥",
    ],
    prices: { rub: 250000, uah: 130000, usd: 3000 },
    video: "/sample-video.mp4",
  },
];

// Active orders with timers: { accountId: timeoutId }
const activeOrders = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stub: validate Telegram initData.
 * In production use crypto.createHmac to verify the hash with your bot token.
 */
function validateTgInitData(initData) {
  if (!initData || typeof initData !== "string") return false;
  return initData.length > 0;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/accounts — return full list
app.get("/api/accounts", (_req, res) => {
  res.json({ accounts });
});

// POST /api/accounts — add a new account (admin)
app.post("/api/accounts", (req, res) => {
  const { id, title, status, skins, prices, video, rank } = req.body;

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

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

// POST /api/create-order — create a rental order
app.post("/api/create-order", (req, res) => {
  const { accountId, tgInitData } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  if (!validateTgInitData(tgInitData)) {
    return res.status(401).json({ error: "Invalid Telegram data" });
  }

  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  if (account.status !== "available") {
    return res.status(409).json({ error: "Account is not available" });
  }

  account.status = "rented";

  activeOrders[accountId] = setTimeout(() => {
    account.status = "available";
    delete activeOrders[accountId];
    console.log(`[TIMER] Order for ${accountId} expired — account released`);
  }, 10 * 60 * 1000);

  console.log(`[ORDER] Created for ${accountId} — reserved for 10 min`);

  res.json({
    success: true,
    accountId,
    title: account.title,
    status: "pending",
    paymentUrl: "https://t.me",
    expiresIn: 600,
  });
});

// POST /api/cancel-order — release account before payment
app.post("/api/cancel-order", (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  if (activeOrders[accountId]) {
    clearTimeout(activeOrders[accountId]);
    delete activeOrders[accountId];
    account.status = "available";
    console.log(`[ORDER] Cancelled for ${accountId} — account released`);
  }

  res.json({ success: true, accountId, status: "available" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  MARX SHOP API running on http://localhost:${PORT}\n`);
});
