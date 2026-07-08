const axios = require("axios");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
// Mainnet
const BASE_URL = "https://pay.crypto.bot";

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  // Fixed test amount: 0.1 USDT
  const amount = "0.1";

  console.log(`[CRYPTO_PAY] POST ${BASE_URL}/api/createInvoice`);
  console.log(`[CRYPTO_PAY] body: { asset: "${asset}", amount: "${amount}" }`);

  const { data } = await axios({
    method: "POST",
    url: `${BASE_URL}/api/createInvoice`,
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
    },
    data: {
      asset: asset,
      amount: amount,
      paid_btn_name: "callback",
      paid_btn_url: process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP",
      payload: String(payload),
    },
  });

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

  const { data } = await axios({
    method: "GET",
    url: `${BASE_URL}/api/getInvoices`,
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
