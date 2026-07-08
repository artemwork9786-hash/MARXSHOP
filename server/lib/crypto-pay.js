const axios = require("axios");
const https = require("https");
const dns = require("dns");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
const HOSTNAME = "pay.crypto.bot";

// Cache for resolved IP
let cachedIp = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve hostname to IPv4 via Google DNS (8.8.8.8)
 * Bypasses Railway's broken system DNS
 */
async function resolveHost() {
  if (cachedIp && Date.now() < cacheExpiry) {
    return cachedIp;
  }

  const ips = await dns.promises.resolve4(HOSTNAME, { server: "8.8.8.8" });
  cachedIp = ips[0];
  cacheExpiry = Date.now() + CACHE_TTL;

  console.log(`[CRYPTO_PAY] Resolved ${HOSTNAME} → ${cachedIp}`);
  return cachedIp;
}

/**
 * Create a Crypto Pay invoice (mainnet, 0.1 USDT test)
 */
async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const ip = await resolveHost();

  // SNI agent — force TLS 1.2+, IPv4, correct servername
  const agent = new https.Agent({
    servername: HOSTNAME,
    family: 4,
    minVersion: "TLSv1.2",
  });

  const url = `https://${ip}/api/createInvoice`;
  console.log(`[CRYPTO_PAY] POST ${url}`);

  const { data } = await axios.post(
    url,
    {
      asset: asset,
      amount: "0.1",
      paid_btn_name: "callback",
      paid_btn_url: process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP",
      payload: String(payload),
    },
    {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
        "Host": HOSTNAME,
      },
    }
  );

  console.log(`[CRYPTO_PAY] Response:`, JSON.stringify(data).substring(0, 300));

  if (!data.ok) {
    throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  }

  return {
    payUrl: data.result.pay_url,
    invoiceId: data.result.invoice_id,
  };
}

/**
 * Get invoice status
 */
async function getInvoice(invoiceId) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const ip = await resolveHost();

  const agent = new https.Agent({
    servername: HOSTNAME,
    family: 4,
  });

  const { data } = await axios.get(`https://${ip}/api/getInvoices`, {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
      "Host": HOSTNAME,
    },
    params: { invoice_ids: invoiceId },
  });

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
