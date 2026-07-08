const { execFileSync } = require("child_process");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
const API_URL = "https://pay.crypto.bot/api";

function curlPost(path, body) {
  const url = `${API_URL}${path}`;
  console.log(`[CRYPTO_PAY] curl POST ${url}`);

  const output = execFileSync("curl", [
    "-s", "-X", "POST", url,
    "-H", "Content-Type: application/json",
    "-H", `Crypto-Pay-API-Token: ${CRYPTO_BOT_TOKEN}`,
    "-d", JSON.stringify(body),
  ], { timeout: 30000, encoding: "utf-8" });

  return JSON.parse(output);
}

function curlGet(path) {
  const url = `${API_URL}${path}`;
  console.log(`[CRYPTO_PAY] curl GET ${url}`);

  const output = execFileSync("curl", [
    "-s", "-X", "GET", url,
    "-H", "Content-Type: application/json",
    "-H", `Crypto-Pay-API-Token: ${CRYPTO_BOT_TOKEN}`,
  ], { timeout: 30000, encoding: "utf-8" });

  return JSON.parse(output);
}

async function createInvoice({ asset = "USDT", payload }) {
  if (!CRYPTO_BOT_TOKEN) throw new Error("CRYPTO_BOT_TOKEN is not set");

  const data = curlPost("/createInvoice", {
    asset: asset,
    amount: "0.1",
    paid_btn_name: "callback",
    paid_btn_url: process.env.FRONTEND_URL || "https://artemwork9786-hash.github.io/MARXSHOP",
    payload: String(payload),
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

  const data = curlGet(`/getInvoices?invoice_ids=${invoiceId}`);

  if (!data.ok) throw new Error(`Crypto Pay: ${JSON.stringify(data)}`);
  const items = data.result?.items || [];
  return items[0] || null;
}

module.exports = { createInvoice, getInvoice };
