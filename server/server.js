require("dotenv").config();
console.log("[TOP] Server loading...");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { WebSocketServer } = require("ws");
const storage = require("./lib/storage");
const cryptoPay = require("./lib/crypto-pay");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const Busboy = require("busboy");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ycS3 = require("./lib/yc-s3");

const execFileAsync = promisify(execFile);

async function extractThumbnail(videoUrl) {
  const tmpPath = `/tmp/thumb-${Date.now()}.jpg`;
  try {
    await execFileAsync("ffmpeg", [
      "-y", "-i", videoUrl,
      "-ss", "0.1", "-vframes", "1",
      "-vf", "scale=640:-1",
      "-q:v", "5",
      tmpPath,
    ], { timeout: 30000 });
    const fs = require("fs");
    const buf = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);
    return buf;
  } catch (err) {
    console.error("[THUMB] Extract error:", err.message);
    try { require("fs").unlinkSync(tmpPath); } catch {}
    return null;
  }
}

async function generateThumbnail(videoUrl) {
  if (!ycS3.isConfigured() || !videoUrl) return null;
  const buf = await extractThumbnail(videoUrl);
  if (!buf) return null;
  const key = `thumbnails/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`;
  try {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    await ycS3.s3.send(new PutObjectCommand({
      Bucket: process.env.YC_BUCKET || "marx-shop-videos",
      Key: key,
      Body: buf,
      ContentType: "image/jpeg",
      ACL: "public-read",
    }));
    const url = ycS3.publicUrlForKey(key);
    console.log(`[THUMB] Generated: ${url}`);
    return url;
  } catch (err) {
    console.error("[THUMB] Upload error:", err.message);
    return null;
  }
}

async function extractDuration(videoUrl) {
  if (!videoUrl) return null;
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoUrl,
    ], { timeout: 15000 });
    const seconds = parseFloat(stdout.trim());
    return isNaN(seconds) ? null : Math.round(seconds);
  } catch (err) {
    console.error("[DURATION] Extract error:", err.message);
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 8080;
const isServerless = process.env.NODE_ENV === "production" && !process.env.DATA_DIR;

// ─── WebSocket ───────────────────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcastAccountUpdate(accountId, busyUntil) {
  const msg = JSON.stringify({ type: "account:update", accountId, busyUntil });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
  console.log(`[WS] Broadcast account update: ${accountId}, busyUntil: ${busyUntil}`);
}

// ─── JSON file-based storage for accounts ────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_ACCOUNTS = [
  {
    id: "marx-vip-001", title: "MARX VIP #1", price: 23000,
    status: "В наличии",
    video_url: "", image_url: "/placeholder.svg", thumbnail_url: null,
  },
  {
    id: "marx-vip-002", title: "MARX VIP #2", price: 18500,
    status: "Занят",
    video_url: "", image_url: "/placeholder.svg", thumbnail_url: null,
  },
  {
    id: "marx-vip-003", title: "MARX VIP #3", price: 31000,
    status: "В наличии",
    video_url: "", image_url: "/placeholder.svg", thumbnail_url: null,
  },
];

function extractS3Key(videoUrl) {
  if (!videoUrl || !videoUrl.includes("storage.yandexcloud.net")) return null;
  const match = videoUrl.match(/\/videos\/.+/);
  return match ? match[0].slice(1) : null;
}

function parseLabelToMs(label) {
  if (!label) return 0;
  let ms = 0;
  const dayMatch = label.match(/(\d+)\s*(дн|день|дня|дней)/i);
  const hourMatch = label.match(/(\d+)\s*(ч|час|часа|часов)/i);
  const minMatch = label.match(/(\d+)\s*(м|мин|минут|минуты)/i);
  if (dayMatch) ms += parseInt(dayMatch[1]) * 86400 * 1000;
  if (hourMatch) ms += parseInt(hourMatch[1]) * 3600 * 1000;
  if (minMatch) ms += parseInt(minMatch[1]) * 60 * 1000;
  return ms;
}

let cachedAccounts = null;
let needsMigration = false;

async function loadAccounts() {
  try {
    const data = await ycS3.readJson(ycS3.PRODUCTS_KEY);
    if (Array.isArray(data) && data.length > 0) {
      let migrated = false;
      data.forEach(a => {
        if (!a.category) { a.category = "sale"; migrated = true; }
        if (!a.rentTerms) { a.rentTerms = []; migrated = true; }
        if (!a.tags) { a.tags = []; migrated = true; }
        if (!a.description && a.extraInfo?.length) {
          a.description = { title: "Дополнительная информация:", content: a.extraInfo.join("\n") };
          migrated = true;
        }
        if (typeof a.description === "string") {
          a.description = { title: "", content: a.description };
          migrated = true;
        }
        if (!a.description) { a.description = null; migrated = true; }
        if (a.duration === undefined) { a.duration = null; migrated = true; }
        if (a.thumbnail_url === undefined) { a.thumbnail_url = null; migrated = true; }
        if (a.order_id === undefined) { a.order_id = null; migrated = true; }
        if (a.rent_started_at === undefined) { a.rent_started_at = null; migrated = true; }
        if (a.rent_expires_at === undefined) { a.rent_expires_at = null; migrated = true; }
        if (a.telegram_user_id === undefined) { a.telegram_user_id = null; migrated = true; }
        if (a.telegram_username === undefined) { a.telegram_username = null; migrated = true; }
        // Clean up stale order data if status is available
        if (a.status === "available" || a.status === "busy") {
          if (a.order_id && a.status === "available") { a.order_id = null; migrated = true; }
          if (a.rent_started_at && a.status === "available") { a.rent_started_at = null; migrated = true; }
          if (a.rent_expires_at && a.status === "available") { a.rent_expires_at = null; migrated = true; }
          if (a.payment_deadline && a.status === "available") { a.payment_deadline = null; migrated = true; }
          if (a.paid_at && a.status === "available") { a.paid_at = null; migrated = true; }
          if (a.telegram_user_id && a.status === "available") { a.telegram_user_id = null; migrated = true; }
          if (a.telegram_username && a.status === "available") { a.telegram_username = null; migrated = true; }
        }
        if (a.status === "В наличии") { a.status = "available"; migrated = true; }
        if (a.status === "Занят") { a.status = "waiting_payment"; migrated = true; }
        // Migrate rentTerms: label → durationMs
        if (a.rentTerms && Array.isArray(a.rentTerms)) {
          for (const term of a.rentTerms) {
            if (!term.durationMs && term.label) {
              term.durationMs = parseLabelToMs(term.label);
              migrated = true;
            }
          }
        }
      });
      if (migrated) await ycS3.writeJson(ycS3.PRODUCTS_KEY, data);

      // Background: extract duration for accounts without it
      const needsDuration = data.filter(a => a.video_url && !a.duration);
      if (needsDuration.length > 0) {
        (async () => {
          for (const a of needsDuration) {
            try {
              const dur = await extractDuration(a.video_url);
              if (dur) {
                const accs = await loadAccounts();
                const acc = accs.find(x => x.id === a.id);
                if (acc && !acc.duration) { acc.duration = dur; await saveAccounts(accs); }
              }
            } catch {}
          }
          console.log(`[MIGRATION] Duration extracted for ${needsDuration.length} accounts`);
        })();
      }
      return data;
    }
    console.log("[S3] No data found, writing empty array");
    await ycS3.writeJson(ycS3.PRODUCTS_KEY, []);
    return [];
  } catch (e) {
    console.error("[S3] Error loading accounts:", e.message);
    return [];
  }
}

async function saveAccounts(accounts) {
  await ycS3.writeJson(ycS3.PRODUCTS_KEY, accounts);
}

function invalidateCache() { cachedAccounts = null; }

// ─── Admin auth middleware ───────────────────────────────────────────────────

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "verykindandfriendlyguy";
const BOT_TOKEN = process.env.TG_BOT_TOKEN || "";

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN) return true; // No token configured — skip validation (dev mode)
  if (!initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;
    params.delete("hash");

    // Sort params and build data-check-string
    const dataCheckArr = [];
    params.forEach((val, key) => { dataCheckArr.push(`${key}=${val}`); });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join("\n");

    // HMAC-SHA256 with bot token as secret key
    const crypto = require("crypto");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    return hmac === hash;
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const initData = req.headers["x-telegram-init-data"];
  if (!initData) return res.status(403).json({ error: "No Telegram data" });

  // Verify HMAC signature
  if (!verifyTelegramInitData(initData)) {
    return res.status(403).json({ error: "Invalid signature" });
  }

  try {
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get("user") || "{}");
    if (user.username !== ADMIN_USERNAME) {
      return res.status(403).json({ error: "Not admin" });
    }
    next();
  } catch {
    return res.status(403).json({ error: "Invalid Telegram data" });
  }
}

// ─── Static files — uploaded videos ──────────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "public", "uploads", "videos");
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
ensureUploadsDir();

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXCHANGE_RATES = { USD: 90, UAH: 2.4 };

function toRub(amount, fromCurrency) {
  if (fromCurrency === "RUB") return amount;
  const rate = EXCHANGE_RATES[fromCurrency];
  if (!rate) throw new Error(`Unsupported currency: ${fromCurrency}`);
  return Math.round(amount * rate);
}

// ─── CORS ────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: [
      "https://artemwork9786-hash.github.io",
      "https://web.telegram.org",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data"],
  })
);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// ─── Video upload (BEFORE express.json to preserve multipart stream) ──────────

app.post("/api/upload-video", (req, res) => { console.log("[UPLOAD-DBG] reached handler"); console.log("[UPLOAD-DBG] CT:", req.headers["content-type"]);
  if (!req.is("multipart/*")) {
    return res.status(400).json({ error: "Expected multipart/form-data" });
  }

  const busboy = Busboy({ headers: req.headers, limits: { fileSize: 500 * 1024 * 1024 } });
  let fileData = null;
  let fileName = "video.mp4";
  let fileMime = "video/mp4";

  busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
    if (!filename) { file.resume(); return; }
    fileName = filename;
    fileMime = mimetype || "video/mp4";
    const chunks = [];
    file.on("data", (chunk) => chunks.push(chunk));
    file.on("end", () => { fileData = Buffer.concat(chunks); });
  });

  busboy.on("finish", async () => {
    if (!fileData) return res.status(400).json({ error: "No file uploaded" });

    if (ycS3.isConfigured()) {
      try {
        const result = await ycS3.uploadBuffer(fileData, fileName, fileMime);
        console.log(`[UPLOAD] S3: ${result.publicUrl}`);
        return res.json({ video_url: result.publicUrl });
      } catch (s3Err) {
        console.error("[UPLOAD] S3 error:", s3Err.message);
      }
    }
    const ext = fileName.split(".").pop() || "mp4";
    const localName = Date.now() + "-" + crypto.randomBytes(6).toString("hex") + "." + ext;
    const localPath = path.join(UPLOADS_DIR, localName);
    fs.writeFileSync(localPath, fileData);
    const videoUrl = "/uploads/videos/" + localName;
    console.log(`[UPLOAD] Local: ${videoUrl}`);
    res.json({ video_url: videoUrl });
  });

  req.pipe(busboy);
});

app.use(express.json());

// ─── Video proxy (fixes CORS for poster extraction on mobile) ─────────────────
// Yandex Cloud Serverless Containers has a ~3.5MB response limit.
// We only fetch the first 3MB from S3 — enough for the moov atom / first frame.

const PROXY_MAX_BYTES = 3 * 1024 * 1024;
const PROXY_ALLOWED_HOSTS = ["storage.yandexcloud.net"];

app.get("/api/proxy-video", (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith("https://")) {
    return res.status(400).json({ error: "https url required" });
  }
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: "invalid url" }); }
  if (!PROXY_ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ error: "host not allowed" });
  }

  const opts = { headers: { Range: `bytes=0-${PROXY_MAX_BYTES - 1}` } };

  const proxyReq = https.get(url, opts, (proxyRes) => {
    const statusCode = proxyRes.statusCode === 206 ? 206 : 200;
    res.writeHead(statusCode, {
      "Content-Type": proxyRes.headers["content-type"] || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      ...(proxyRes.headers["content-range"] && { "Content-Range": proxyRes.headers["content-range"] }),
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => res.status(502).end());
  req.on("close", () => proxyReq.destroy());
});

// ─── Presigned S3 upload URL (client uploads directly to S3) ─────────────────

app.post("/api/presign-upload", requireAdmin, async (req, res) => {
  if (!ycS3.isConfigured()) {
    return res.status(503).json({ error: "S3 not configured" });
  }
  const { filename, contentType } = req.body;
  if (!filename) return res.status(400).json({ error: "filename is required" });
  try {
    const result = await ycS3.getPresignedUploadUrl(filename, contentType || "video/mp4");
    console.log(`[PRESIGN] ${filename} → ${result.key}`);
    res.json(result);
  } catch (err) {
    console.error("[PRESIGN] Error:", err.message);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

app.get("/api/accounts", async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  const accounts = await loadAccounts();
  res.json({ accounts });
});

app.get("/api/config", (req, res) => {
  res.json({ adminUsername: ADMIN_USERNAME });
});


app.get("/api/my-accounts", async (req, res) => {
  const tgUser = extractTelegramUser(req);
  if (!tgUser?.id) return res.json({ accounts: [] });

  const accounts = await loadAccounts();
  const myAccounts = accounts.filter(a =>
    a.telegram_user_id === tgUser.id &&
    a.status !== "available"
  );

  const result = myAccounts.map(a => ({
    id: a.id,
    title: a.title,
    category: a.category,
    status: a.status,
    order_id: a.order_id || null,
    rent_started_at: a.rent_started_at || null,
    rent_expires_at: a.rent_expires_at || null,
    thumbnail_url: a.thumbnail_url || null,
    duration: a.duration || null,
    rentTerms: a.rentTerms || [],
    price: a.price || 0,
  }));

  res.json({ accounts: result });
});

app.post("/api/accounts", requireAdmin, async (req, res) => {
  const { title, price, currency, status, video_url, image_url, category, rentTerms, tags, description } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const accounts = await loadAccounts();
  const newAccount = {
    id: `marx-vip-${Date.now()}`,
    title,
    category: category || "sale",
    price: Number(price) || 0,
    currency: currency || "RUB",
    status: status || "available",
    video_url: video_url || "",
    image_url: image_url || "/placeholder.svg",
    thumbnail_url: null,
    order_id: null,
    rent_started_at: null,
    rent_expires_at: null,
    rentTerms: rentTerms || [],
    tags: tags || [],
    description: description || null,
  };
  accounts.push(newAccount);
  await saveAccounts(accounts);
  console.log(`[ADMIN] Account added: ${newAccount.title}`);

  // Generate thumbnail and duration in background
  if (video_url) {
    Promise.all([
      generateThumbnail(video_url),
      extractDuration(video_url),
    ]).then(async ([thumbUrl, duration]) => {
      const accs = await loadAccounts();
      const a = accs.find(x => x.id === newAccount.id);
      if (a) {
        if (thumbUrl) a.thumbnail_url = thumbUrl;
        if (duration) a.duration = duration;
        await saveAccounts(accs);
      }
    }).catch(() => {});
  }
  res.status(201).json({ success: true, account: newAccount });
});

app.put("/api/accounts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Account not found" });

  const { title, price, currency, status, video_url, image_url, category, rentTerms, tags, description } = req.body;
  const videoChanged = video_url !== undefined && video_url !== accounts[idx].video_url;
  const statusChanged = status !== undefined && status !== accounts[idx].status;

  // Delete old video + thumbnail from S3 if replaced
  if (videoChanged && accounts[idx].video_url) {
    const oldKey = extractS3Key(accounts[idx].video_url);
    if (oldKey) await ycS3.deleteVideo(oldKey);
    const oldThumbKey = extractS3Key(accounts[idx].thumbnail_url);
    if (oldThumbKey) await ycS3.deleteVideo(oldThumbKey);
  }

  // Clear order data when admin manually resets status to available
  const clearOrderData = statusChanged && (status === "available");

  accounts[idx] = {
    ...accounts[idx],
    title: title !== undefined ? title : accounts[idx].title,
    category: category !== undefined ? category : accounts[idx].category,
    price: price !== undefined ? Number(price) : accounts[idx].price,
    currency: currency !== undefined ? currency : (accounts[idx].currency || "RUB"),
    status: status !== undefined ? status : accounts[idx].status,
    video_url: video_url !== undefined ? video_url : accounts[idx].video_url,
    image_url: image_url !== undefined ? image_url : accounts[idx].image_url,
    order_id: clearOrderData ? null : accounts[idx].order_id,
    rent_started_at: clearOrderData ? null : accounts[idx].rent_started_at,
    rent_expires_at: clearOrderData ? null : accounts[idx].rent_expires_at,
    payment_deadline: clearOrderData ? null : accounts[idx].payment_deadline,
    paid_at: clearOrderData ? null : accounts[idx].paid_at,
    telegram_user_id: clearOrderData ? null : accounts[idx].telegram_user_id,
    telegram_username: clearOrderData ? null : accounts[idx].telegram_username,
    thumbnail_url: videoChanged ? null : accounts[idx].thumbnail_url,
    rentTerms: rentTerms !== undefined ? rentTerms : accounts[idx].rentTerms,
    tags: tags !== undefined ? tags : accounts[idx].tags,
    description: description !== undefined ? description : accounts[idx].description,
  };
  await saveAccounts(accounts);
  console.log(`[ADMIN] Account updated: ${id}`);
  res.json({ success: true, account: accounts[idx] });

  // Generate thumbnail and duration in background if video changed
  if (videoChanged && accounts[idx].video_url) {
    const accountId = id;
    Promise.all([
      generateThumbnail(accounts[idx].video_url),
      extractDuration(accounts[idx].video_url),
    ]).then(async ([thumbUrl, duration]) => {
      const accs = await loadAccounts();
      const a = accs.find(x => x.id === accountId);
      if (a) {
        if (thumbUrl) a.thumbnail_url = thumbUrl;
        if (duration) a.duration = duration;
        await saveAccounts(accs);
      }
    }).catch(() => {});
  }
});

app.delete("/api/accounts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Account not found" });

  // Delete video AND thumbnail from S3
  const videoUrl = accounts[idx].video_url;
  const thumbUrl = accounts[idx].thumbnail_url;
  const videoKey = extractS3Key(videoUrl);
  const thumbKey = extractS3Key(thumbUrl);
  if (videoKey) await ycS3.deleteVideo(videoKey);
  if (thumbKey) await ycS3.deleteVideo(thumbKey);

  accounts.splice(idx, 1);
  await saveAccounts(accounts);
  console.log(`[ADMIN] Account deleted: ${id}`);
  res.json({ success: true, id });
});

// ─── Orders / Payments ───────────────────────────────────────────────────────

app.post("/api/create-order", async (req, res) => {
  try {
    const { accountId, currency, method, tgInitData, rentTerm, rentPrice, rentDurationMs } = req.body;

    if (!accountId) return res.status(400).json({ error: "accountId is required" });
    if (!method || !["crypto", "sbp"].includes(method)) {
      return res.status(400).json({ error: "method must be 'crypto' or 'sbp'" });
    }
    if (!currency || !["RUB", "UAH", "USD"].includes(currency)) {
      return res.status(400).json({ error: "currency must be RUB, UAH, or USD" });
    }

    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.status !== "available") return res.status(409).json({ error: "Account is not available" });

    storage.reserveAccount(accountId, accounts);
    if (rentDurationMs) account.rent_duration = rentDurationMs;
    await saveAccounts(accounts);
    broadcastAccountUpdate(accountId, account.busyUntil);

    const price = (rentTerm && rentPrice) ? Number(rentPrice) : account.price;
    const order = storage.createOrder({ accountId, currency, method, rentTerm: rentTerm || null });

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

app.get("/api/check-order", async (req, res) => {
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const order = storage.getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status === "PENDING" && Date.now() > order.expiresAt) {
    storage.updateOrder(orderId, { status: "EXPIRED" });
    const accounts = await loadAccounts();
    storage.releaseAccount(order.accountId, accounts);
    await saveAccounts(accounts);
    return res.json({ orderId, status: "EXPIRED", paidAt: null });
  }

  res.json({
    orderId,
    status: order.status,
    paidAt: order.paidAt || null,
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

// ─── Regenerate thumbnails for accounts missing them ─────────────────────────

app.post("/api/admin/generate-thumbnails", requireAdmin, async (req, res) => {
  const accounts = await loadAccounts();
  let generated = 0;
  for (const a of accounts) {
    if (a.video_url && !a.thumbnail_url) {
      const thumbUrl = await generateThumbnail(a.video_url);
      if (thumbUrl) {
        a.thumbnail_url = thumbUrl;
        generated++;
      }
    }
  }
  if (generated > 0) await saveAccounts(accounts);
  res.json({ success: true, generated, total: accounts.length });
});

// ─── Admin: Orders for payment verification ─────────────────────────────────

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const accounts = await loadAccounts();
  const now = Date.now();
  let changed = false;

  // Auto-release: waiting_payment > 10 minutes → available
  for (const a of accounts) {
    if (a.status === "waiting_payment" && a.payment_deadline && now > a.payment_deadline) {
      a.status = "available";
      a.busyUntil = null;
      a.order_id = null;
      a.payment_deadline = null;
      a.telegram_user_id = null;
      a.telegram_username = null;
      changed = true;
      console.log(`[AUTO-RELEASE] ${a.title} — payment deadline expired`);
    }
  }

  // Auto-release: payment_confirmed > 1 hour → available (rule #22: 1 hour to confirm)
  for (const a of accounts) {
    if (a.status === "payment_confirmed" && a.confirmed_at && now > a.confirmed_at + 60 * 60 * 1000) {
      a.status = "available";
      a.busyUntil = null;
      a.order_id = null;
      a.payment_deadline = null;
      a.confirmed_at = null;
      a.rent_duration = null;
      a.telegram_user_id = null;
      a.telegram_username = null;
      changed = true;
      console.log(`[AUTO-RELEASE] ${a.title} — confirmation deadline expired (1 hour)`);
    }
  }

  // Auto-release: active + rent_expires_at passed → available
  for (const a of accounts) {
    if (a.status === "active" && a.rent_expires_at && now > a.rent_expires_at) {
      a.status = "available";
      a.busyUntil = null;
      a.order_id = null;
      a.rent_started_at = null;
      a.rent_expires_at = null;
      a.rent_duration = null;
      a.telegram_user_id = null;
      a.telegram_username = null;
      changed = true;
      console.log(`[AUTO-RELEASE] ${a.title} — rental time expired`);
    }
  }

  if (changed) await saveAccounts(accounts);

  const orders = accounts
    .filter(a => a.status === "waiting_payment" || a.status === "paid_verifying" || a.status === "payment_confirmed")
    .map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      price: a.price || 0,
      currency: a.currency || "RUB",
      status: a.status,
      order_id: a.order_id || null,
      telegram_user_id: a.telegram_user_id || null,
      telegram_username: a.telegram_username || null,
      payment_deadline: a.payment_deadline || null,
      paid_at: a.paid_at || null,
      confirmed_at: a.confirmed_at || null,
      created_at: a.payment_deadline ? a.payment_deadline - 10 * 60 * 1000 : null,
      rentTerms: a.rentTerms || [],
    }));

  res.json({ orders });
});

// ─── Payment simulation flow ────────────────────────────────────────────────

const MSK_OFFSET = 3 * 60 * 60 * 1000;
const PAYMENT_WINDOW = 10 * 60 * 1000; // 10 minutes to complete payment

function extractTelegramUser(req) {
  const initData = req.headers["x-telegram-init-data"];
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    return JSON.parse(params.get("user") || "{}");
  } catch { return null; }
}

app.post("/api/orders/pay", async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const tgUser = extractTelegramUser(req);

  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.status !== "available") return res.status(409).json({ error: "Account is not available" });

  const orderId = `order-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  account.status = "waiting_payment";
  account.order_id = orderId;
  account.payment_deadline = Date.now() + PAYMENT_WINDOW;
  if (tgUser?.id) account.telegram_user_id = tgUser.id;
  if (tgUser?.username) account.telegram_username = tgUser.username;
  await saveAccounts(accounts);

  console.log(`[ORDER] ${orderId} → waiting_payment for ${accountId} (user: ${tgUser?.username || "unknown"}, id: ${tgUser?.id || "null"})`);
  console.log(`[ORDER] telegram_user_id saved: ${account.telegram_user_id}`);
  res.json({ success: true, orderId, status: "waiting_payment" });
});

app.post("/api/orders/test-pay", async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.status !== "waiting_payment") return res.status(409).json({ error: "Account is not in waiting_payment status" });

  account.status = "paid_verifying";
  account.paid_at = Date.now();
  await saveAccounts(accounts);

  console.log(`[ORDER] ${account.order_id} → paid_verifying (test pay)`);
  res.json({ success: true, orderId: account.order_id, status: "paid_verifying" });
});

app.post("/api/orders/confirm-payment", requireAdmin, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.status !== "paid_verifying") return res.status(409).json({ error: "Account is not in paid_verifying status" });

  account.status = "payment_confirmed";
  account.confirmed_at = Date.now();
  await saveAccounts(accounts);

  console.log(`[ORDER] ${account.order_id} → payment_confirmed`);
  res.json({ success: true, orderId: account.order_id, status: "payment_confirmed" });
});

app.post("/api/orders/approve", requireAdmin, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.status !== "payment_confirmed") return res.status(409).json({ error: "Account is not in payment_confirmed status" });

  account.status = "active";
  account.rent_started_at = Date.now();
  account.rent_expires_at = Date.now() + (account.rent_duration || 24 * 60 * 60 * 1000);
  await saveAccounts(accounts);

  console.log(`[ORDER] ${account.order_id} → active (approved)`);
  res.json({ success: true, orderId: account.order_id, status: "active" });
});

app.post("/api/orders/reject", requireAdmin, async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (account.status !== "paid_verifying" && account.status !== "waiting_payment" && account.status !== "payment_confirmed") return res.status(409).json({ error: "Account is not pending verification" });

  account.status = "available";
  account.order_id = null;
  account.paid_at = null;
  account.confirmed_at = null;
  await saveAccounts(accounts);

  console.log(`[ORDER] ${account.order_id} → available (rejected)`);
  res.json({ success: true, status: "available" });
});

app.get("/api/orders/status/:accountId", async (req, res) => {
  const accounts = await loadAccounts();
  const account = accounts.find(a => a.id === req.params.accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });

  res.json({
    accountId: account.id,
    status: account.status,
    order_id: account.order_id || null,
    rent_started_at: account.rent_started_at || null,
    rent_expires_at: account.rent_expires_at || null,
    confirmed_at: account.confirmed_at || null,
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

app.post("/api/admin/verify-order", requireAdmin, (req, res) => {
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

app.post("/api/cancel-order", async (req, res) => {
  const { accountId, orderId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return res.status(404).json({ error: "Account not found" });

  storage.releaseAccount(accountId, accounts);
  await saveAccounts(accounts);
  broadcastAccountUpdate(accountId, null);

  const pendingOrders = storage.getOrdersByAccountId(accountId);
  for (const o of pendingOrders) {
    if (o.status === "PENDING") {
      storage.updateOrder(o.id, { status: "EXPIRED" });
    }
  }

  console.log(`[ORDER] Cancelled for ${accountId}`);
  res.json({ success: true, accountId, status: "В наличии" });
});

// ─── Healthcheck ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  MARX SHOP API running on http://0.0.0.0:${PORT}${isServerless ? " (serverless)" : ""}\n`);
  console.log(`  WebSocket ready on ws://0.0.0.0:${PORT}\n`);
});
