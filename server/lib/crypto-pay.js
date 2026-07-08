const CRYPTO_PAY_API = "https://api.crypto.bot";
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

  const res = await fetch(`${CRYPTO_PAY_API}/api/createInvoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRYPTO_BOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Crypto Pay API error: ${JSON.stringify(data)}`);
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

  const res = await fetch(`${CRYPTO_PAY_API}/api/getInvoices?invoice_ids=${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${CRYPTO_BOT_TOKEN}`,
    },
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Crypto Pay API error: ${JSON.stringify(data)}`);
  }

  const invoices = data.result?.items || [];
  return invoices[0] || null;
}

module.exports = { createInvoice, getInvoice };
