const axios = require("axios");
const https = require("https");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Explicit SNI agent — tells Cloudflare the correct servername
const agent = new https.Agent({
  servername: "pay.crypto.bot",
});

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const amount = "0.1";

  console.log(`[CRYPTO_PAY] Creating invoice: ${asset} ${amount}`);

  const { data } = await axios.post(
    "https://crypto.bot/api/createInvoice",
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
        "Host": "pay.crypto.bot",
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

  const { data } = await axios.get("https://crypto.bot/api/getInvoices", {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
      "Host": "pay.crypto.bot",
    },
    params: { invoice_ids: invoiceId },
  });

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
