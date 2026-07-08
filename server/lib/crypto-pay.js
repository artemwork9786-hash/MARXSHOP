const { spawnSync } = require("child_process");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;
const API_URL = "https://pay.crypto.bot/api";

function curlPost(path, body) {
  const url = `${API_URL}${path}`;
  console.log(`[CRYPTO_PAY] POST ${url}`);

  const result = spawnSync("curl", [
    "-s", "-w", "\n%{http_code}",
    "-X", "POST", url,
    "-H", "Content-Type: application/json",
    "-H", `Crypto-Pay-API-Token: ${CRYPTO_BOT_TOKEN}`,
    "-d", JSON.stringify(body),
  ], { timeout: 30000, encoding: "utf-8" });

  if (result.error) {
    console.error(`[CRYPTO_PAY] curl spawn error:`, result.error.message);
    throw new Error(`curl failed: ${result.error.message}`);
  }

  console.log(`[CRYPTO_PAY] curl exit: ${result.status}`);
  if (result.stderr) console.log(`[CRYPTO_PAY] stderr: ${result.stderr.substring(0, 300)}`);

  const lines = result.stdout.split("\n");
  const httpCode = lines.pop();
  const bodyStr = lines.join("\n");

  console.log(`[CRYPTO_PAY] HTTP ${httpCode}`);

  if (httpCode !== "200") {
    throw new Error(`Crypto Pay HTTP ${httpCode}: ${bodyStr.substring(0, 200)}`);
  }

  return JSON.parse(bodyStr);
}

function curlGet(path) {
  const url = `${API_URL}${path}`;
  console.log(`[CRYPTO_PAY] GET ${url}`);

  const result = spawnSync("curl", [
    "-s", "-w", "\n%{http_code}",
    "-X", "GET", url,
    "-H", "Content-Type: application/json",
    "-H", `Crypto-Pay-API-Token: ${CRYPTO_BOT_TOKEN}`,
  ], { timeout: 30000, encoding: "utf-8" });

  if (result.error) throw new Error(`curl failed: ${result.error.message}`);

  const lines = result.stdout.split("\n");
  const httpCode = lines.pop();
  const bodyStr = lines.join("\n");

  if (httpCode !== "200") throw new Error(`Crypto Pay HTTP ${httpCode}: ${bodyStr.substring(0, 200)}`);
  return JSON.parse(bodyStr);
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
