function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function durationLabel(d, h, m) {
  const parts = [];
  if (d > 0) parts.push(`${d} ${pluralize(d, "день", "дня", "дней")}`);
  if (h > 0) parts.push(`${h} ${pluralize(h, "час", "часа", "часов")}`);
  if (m > 0) parts.push(`${m} ${pluralize(m, "минута", "минуты", "минут")}`);
  return parts.join(" ") || "0 минут";
}

export function durationToMs(d, h, m) {
  return ((d || 0) * 86400 + (h || 0) * 3600 + (m || 0) * 60) * 1000;
}

export function msToDuration(ms) {
  if (!ms) return { d: 0, h: 0, m: 0 };
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return { d, h, m };
}

export function getTermLabel(term) {
  if (term.type === "special") {
    const name = term.name || "Спец. тариф";
    const time = term.timeFrom && term.timeTo ? ` (${term.timeFrom}-${term.timeTo})` : "";
    return `${name}${time}`;
  }
  if (term.label) return term.label;
  if (term.durationMs) {
    const { d, h, m } = msToDuration(term.durationMs);
    return durationLabel(d, h, m);
  }
  return "—";
}
