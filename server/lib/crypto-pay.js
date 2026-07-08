const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Testnet: https://testnet-pay.crypto.bot  |  Mainnet: https://api.crypto.bot
const CRYPTO_PAY_API = process.env.CRYPTO_PAY_API_URL || "https://testnet-pay.crypto.bot";

// Testnet only supports USD fiat — force it
const isTestnet = CRYPTO_PAY_API.includes("testnet");
const SUPPORTED_FIAT = isTestnet ? ["USD"] : ["RUB", "UAH", "USD", "EUR", "GBP", "KZT"];

/**
 * Create a fiat invoice via Crypto Pay API
 * @param {{ asset, fiat, amount, paid_btn_name, paid_btn_url, payload }} params
 * @returns {{ pay_url, invoice_id }}
 */
async function createInvoice({ asset = "USDT", fiat, amount, paid_btn_name = "callback", paid_btn_url, payload }) {
  if (!CRYPTO_BOT_TOKEN) {
    throw new Error("CRYPTO_BOT_TOKEN is not set");
  }

  // Force USD for testnet — RUB/UAH not supported
  const invoiceFiat = SUPPORTED_FIAT.includes(fiat) ? fiat : "USD";
  const invoiceAmount = isTestnet && fiat !== "USD" ? 500 : amount;

  console.log(`[CRYPTO_PAY] API: ${CRYPTO_PAY_API}`);
  console.log(`[CRYPTO_PAY] Creating invoice: ${invoiceFiat} ${invoiceAmount} (original: ${fiat} ${amount}), asset: ${asset}`);

  const body = {
    asset,
    fiat: invoiceFiat,
    amount: String(invoiceAmount),
    paid_btn_name,
    payload: String(payload),
  };
  if (paid_btn_url) body.paid_btn_url = paid_btn_url;

  let res;
  try {
    res = await fetch(`${CRYPTO_PAY_API}/api/createInvoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRYPTO_BOT_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[CRYPTO_PAY] Network error: ${err.message}`);
    throw err;
  }

  const responseText = await res.text();
  console.log(`[CRYPTO_PAY] Response status: ${res.status}`);
  console.log(`[CRYPTO_PAY] Response body: ${responseText.substring(0, 500)}`);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    console.error(`[CRYPTO_PAY] Failed to parse JSON: ${err.message}`);
    console.error(`[CRYPTO_PAY] Raw response was: ${responseText}`);
    throw new Error(`Crypto Pay returned non-JSON (status ${res.status}): ${responseText.substring(0, 200)}`);
  }

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
}

/**
 * Get invoice status from Crypto Pay API
 * @param {string} invoiceId
 * @returns {{ status, ... }}
 */
async function getInvoice(invoiceId) {
  if (!CRYPTO_BOT_TOKEN) {
    throw new Error("CRYPTO_BOT_TOKEN is not set");
  }

  let res;
  try {
    res = await fetch(`${CRYPTO_PAY_API}/api/getInvoices?invoice_ids=${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${CRYPTO_BOT_TOKEN}`,
      },
    });
  } catch (err) {
    console.error(`[CRYPTO_PAY] Network error (getInvoice): ${err.message}`);
    throw err;
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Crypto Pay API error: ${JSON.stringify(data)}`);
  }

  const invoices = data.result?.items || [];
  return invoices[0] || null;
}

module.exports = { createInvoice, getInvoice };
