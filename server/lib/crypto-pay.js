// Crypto Pay integration — manual invoice flow
// The pay.crypto.bot API is inaccessible from servers (AWS Global Accelerator blocks TLS).
// Users create invoices manually in @CryptoBot, then enter the invoice_id.

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

/**
 * Get instructions for manual invoice creation.
 * This does NOT call the Crypto Pay API — it returns static instructions.
 */
function getPayInstructions(orderId) {
  return {
    botUsername: "CryptoBot",
    asset: "USDT",
    amount: "0.1",
    comment: `MARX-${orderId.slice(-8).toUpperCase()}`,
    steps: [
      "Откройте @CryptoBot в Telegram",
      "Нажмите Pay → Invoice",
      "Выберите USDT",
      "Введите сумму: 0.1",
      "В комментарий укажите: MARX-" + orderId.slice(-8).toUpperCase(),
      "Скопируйте Invoice ID из чека",
      "Вставьте Invoice ID в поле ниже",
    ],
  };
}

/**
 * Verify an invoice manually.
 * Since we can't call the Crypto Pay API, we store the invoice_id
 * and mark it as awaiting manual verification by admin.
 */
function createManualInvoice({ orderId, invoiceId }) {
  // In a real app, this would call Crypto Pay API to verify.
  // For now, we store it and mark as AWAITING_VERIFICATION.
  return {
    orderId,
    invoiceId,
    status: "AWAITING_VERIFICATION",
    message: "Invoice ID получен. Ожидает подтверждения оплаты.",
  };
}

module.exports = { getPayInstructions, createManualInvoice };
