const https = require("https");
const dns = require("dns");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Cloudflare Worker proxy — bypasses Railway SSL/DNS issues
const WORKER_URL = "https://quiet-snow-054e.artemwork9786.workers.dev";

let cachedIp = null;
let cacheExpiry = 0;

async function resolveHost() {
  if (cachedIp && Date.now() < cacheExpiry) return cachedIp;
  const url = new URL(WORKER_URL);
  const ips = await dns.promises.resolve4(url.hostname, { server: "8.8.8.8" });
  cachedIp = ips[0];
  cacheExpiry = Date.now() + 5 * 60 * 1000;
  console.log(`[CRYPTO_PAY] Resolved worker → ${cachedIp}`);
  return cachedIp;
}

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          reject(new Error(`Non-JSON (${res.statusCode}): ${data.substring(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const ip = await resolveHost();
  const path = "/createInvoice";

  console.log(`[CRYPTO_PAY] POST ${WORKER_URL}${path}`);

  const { status, data } = await httpsRequest(
    `${WORKER_URL}${path}`,
    {
      method: "POST",
      hostname: ip,
      port: 443,
      path: path,
      servername: new URL(WORKER_URL).hostname,
      family: 4,
      minVersion: "TLSv1.2",
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
      },
    },
    {
      asset: asset,
      amount: "0.1",
      paid_btn_name: "callback",
      paid_btn_url: process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP",
      payload: String(payload),
    }
  );

  console.log(`[CRYPTO_PAY] Response (${status}):`, JSON.stringify(data).substring(0, 300));

  if (!data.ok) {
    throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  }

  return {
    payUrl: data.result.pay_url,
    invoiceId: data.result.invoice_id,
  };
}

async function getInvoice(invoiceId) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const ip = await resolveHost();
  const path = `/getInvoices?invoice_ids=${invoiceId}`;

  const { data } = await httpsRequest(
    `${WORKER_URL}${path}`,
    {
      method: "GET",
      hostname: ip,
      port: 443,
      path: path,
      servername: new URL(WORKER_URL).hostname,
      family: 4,
      minVersion: "TLSv1.2",
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
      },
    },
    null
  );

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
