const https = require("https");
const dns = require("dns");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
const HOSTNAME = "api.crypt.bot";

let cachedIp = null;
let cacheExpiry = 0;

async function resolveHost() {
  if (cachedIp && Date.now() < cacheExpiry) return cachedIp;
  const ips = await dns.promises.resolve4(HOSTNAME, { server: "8.8.8.8" });
  cachedIp = ips[0];
  cacheExpiry = Date.now() + 5 * 60 * 1000;
  console.log(`[CRYPTO_PAY] Resolved ${HOSTNAME} → ${cachedIp}`);
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
          reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const ip = await resolveHost();

  console.log(`[CRYPTO_PAY] POST https://${ip}/api/createInvoice`);

  const { status, data } = await httpsRequest(
    `https://${ip}/api/createInvoice`,
    {
      method: "POST",
      hostname: ip,
      port: 443,
      path: "/api/createInvoice",
      servername: HOSTNAME,
      family: 4,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
        "Host": HOSTNAME,
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

  const { data } = await httpsRequest(
    `https://${ip}/api/getInvoices?invoice_ids=${invoiceId}`,
    {
      method: "GET",
      hostname: ip,
      port: 443,
      path: `/api/getInvoices?invoice_ids=${invoiceId}`,
      servername: HOSTNAME,
      family: 4,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
        "Host": HOSTNAME,
      },
    },
    null
  );

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
