// Crypto Pay integration — manual invoice flow
// Users create invoices manually in @CryptoBot, then enter the invoice_id.

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

// Fixed exchange rates for crypto display (MVP)
const USDT_RATES = { RUB: 90, UAH: 2.4, USD: 1 };

function getPayInstructions(orderId, amount, currency) {
  // Convert to approximate USDT amount
  const rate = USDT_RATES[currency] || 1;
  const usdtAmount = currency === "USD" ? amount : (amount / rate).toFixed(2);

  return {
    botUsername: "CryptoBot",
    asset: "USDT",
    amount: usdtAmount,
    comment: `MARX-${orderId.slice(-8).toUpperCase()}`,
    steps: [
      `Откройте @CryptoBot в Telegram`,
      `Нажмите Pay → Invoice`,
      `Выберите USDT`,
      `Введите сумму: ${usdtAmount} USDT`,
      `В комментарий укажите: MARX-${orderId.slice(-8).toUpperCase()}`,
      `Скопируйте Invoice ID из чека`,
      `Вставьте Invoice ID в поле ниже`,
    ],
  };
}

module.exports = { getPayInstructions };
