// Testnet: https://crypto.bot  |  Mainnet: https://api.crypto.bot
const CRYPTO_PAY_API = process.env.CRYPTO_PAY_API_URL || "https://crypto.bot";
const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

/**
 * Create a fiat invoice via Crypto Pay API
 * @param {{ asset, fiat, amount, paid_btn_name, paid_btn_url, payload }} params
 * @returns {{ pay_url, invoice_id }}
 */
async function createInvoice({ asset = "USDT", fiat, amount, paid_btn_name = "callback", paid_btn_url, payload }) {
  if (!CRYPTO_BOT_TOKEN) {
    throw new Error("CRYPTO_BOT_TOKEN is not set");
  }

  const body = {
    asset,
    fiat,
    amount: String(amount),
    paid_btn_name,
    payload: String(payload),
  };
  if (paid_btn_url) body.paid_btn_url = paid_btn_url;

  console.log(`[CRYPTO_PAY] Creating invoice: ${fiat} ${amount} via ${CRYPTO_PAY_API}`);

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

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error(`[CRYPTO_PAY] Failed to parse response: ${err.message}`);
    throw err;
  }

  console.log(`[CRYPTO_PAY] Response status: ${res.status}, ok: ${data.ok}`);

  if (!data.ok) {
    const errorMsg = data.error
      ? `${data.error.code}: ${data.error.message}`
      : JSON.stringify(data);
    console.error(`[CRYPTO_PAY] API error: ${errorMsg}`);
    throw new Error(`Crypto Pay API error: ${errorMsg}`);
  }

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
