export function convertPrice(price, fromCurrency, toCurrency, rates) {
  if (!price && price !== 0) return 0;
  if (fromCurrency === toCurrency) return price;
  if (!rates?.usd_to_rub) return price;

  // Convert to RUB first
  let priceRub;
  if (fromCurrency === "RUB") priceRub = price;
  else if (fromCurrency === "USD") priceRub = price * rates.usd_to_rub;
  else if (fromCurrency === "UAH") priceRub = price * (rates.usd_to_rub / (rates.usd_to_uah || 41));
  else priceRub = price;

  // Convert from RUB to target
  if (toCurrency === "RUB") return priceRub;
  if (toCurrency === "USD") return Math.round((priceRub / rates.usd_to_rub) * 10) / 10;
  if (toCurrency === "UAH") return Math.round((priceRub / rates.usd_to_rub) * (rates.usd_to_uah || 41));
  return priceRub;
}
