const axios = require("axios");
const https = require("https");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Build URL from components — guaranteed correct
const protocol = "https://";
const subdomain = "pay.";
const domain = "crypto.bot";
const API_BASE = protocol + subdomain + domain + "/api";

// Explicit SNI agent — force IPv4 to avoid Railway DNS/IPv6 issues
const agent = new https.Agent({
  servername: subdomain + domain,
  family: 4,
});

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const amount = "0.1";

  console.log(`[CRYPTO_PAY] POST ${API_BASE}/createInvoice`);

  const { data } = await axios.post(
    API_BASE + "/createInvoice",
    {
      asset: asset,
      amount: amount,
      paid_btn_name: "callback",
      paid_btn_url: process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP",
      payload: String(payload),
    },
    {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json",
        "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
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

async function getInvoice(invoiceId) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const { data } = await axios.get(API_BASE + "/getInvoices", {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
    },
    params: { invoice_ids: invoiceId },
  });

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
