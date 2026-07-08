const axios = require("axios");

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Testnet: https://testnet-pay.crypto.bot  |  Mainnet: https://api.crypto.bot
const BASE_URL = process.env.CRYPTO_PAY_API_URL || "https://testnet-pay.crypto.bot";

const isTestnet = BASE_URL.includes("testnet");
const SUPPORTED_FIAT = isTestnet ? ["USD"] : ["RUB", "UAH", "USD", "EUR", "GBP", "KZT"];

const api = axios.create({
  baseURL: `${BASE_URL}/api/`,
  headers: {
    "Content-Type": "application/json",
    "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN,
  },
  timeout: 15000,
});

/**
 * Create a fiat invoice via Crypto Pay API
 */
async function createInvoice({ asset = "USDT", fiat, amount, paid_btn_name = "callback", paid_btn_url, payload }) {
  if (!CRYPTO_BOT_TOKEN) {
    throw new Error("CRYPTO_BOT_TOKEN is not set");
  }

  const invoiceFiat = SUPPORTED_FIAT.includes(fiat) ? fiat : "USD";
  const invoiceAmount = isTestnet && fiat !== "USD" ? 500 : amount;

  console.log(`[CRYPTO_PAY] Base URL: ${BASE_URL}/api/`);
  console.log(`[CRYPTO_PAY] Creating invoice: ${invoiceFiat} ${invoiceAmount} (original: ${fiat} ${amount})`);

  const body = {
    asset,
    fiat: invoiceFiat,
    amount: String(invoiceAmount),
    paid_btn_name,
    payload: String(payload),
  };
  if (paid_btn_url) body.paid_btn_url = paid_btn_url;

  try {
    const { data } = await api.post("createInvoice", body);

    if (!data.ok) {
      const errorMsg = data.error
        ? `${data.error.code}: ${data.error.message}`
        : JSON.stringify(data);
      console.error(`[CRYPTO_PAY] API error: ${errorMsg}`);
      throw new Error(`Crypto Pay API error: ${errorMsg}`);
    }

    console.log(`[CRYPTO_PAY] Invoice created: id=${data.result.invoice_id}`);
    return {
      payUrl: data.result.pay_url,
      invoiceId: data.result.invoice_id,
    };
  } catch (err) {
    if (err.response) {
      console.error(`[CRYPTO_PAY] HTTP ${err.response.status}:`, JSON.stringify(err.response.data));
    } else {
      console.error(`[CRYPTO_PAY] Error:`, err.message);
    }
    throw err;
  }
}

/**
 * Get invoice status from Crypto Pay API
 */
async function getInvoice(invoiceId) {
  if (!CRYPTO_BOT_TOKEN) {
    throw new Error("CRYPTO_BOT_TOKEN is not set");
  }

  try {
    const { data } = await api.get("getInvoices", {
      params: { invoice_ids: invoiceId },
    });

    if (!data.ok) {
      throw new Error(`Crypto Pay API error: ${JSON.stringify(data)}`);
    }

    const invoices = data.result?.items || [];
    return invoices[0] || null;
  } catch (err) {
    if (err.response) {
      console.error(`[CRYPTO_PAY] getInvoice HTTP ${err.response.status}:`, JSON.stringify(err.response.data));
    } else {
      console.error(`[CRYPTO_PAY] getInvoice error:`, err.message);
    }
    throw err;
  }
}

module.exports = { createInvoice, getInvoice };
