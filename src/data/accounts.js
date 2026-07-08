const VIDEO = "/sample-video.mp4";

export const mockAccounts = [
  {
    id: "marx-vip-001",
    title: "MARX VIP #1",
    status: "available",
    skins: ["M416 Дракон", "Костюм Мумия", "AWM Космос"],
    prices: { rub: 23000, uah: 12400, usd: 280 },
    video: VIDEO,
  },
  {
    id: "marx-vip-002",
    title: "MARX VIP #2",
    status: "rented",
    skins: ["AKM Викинг", "УАЗ Тёмный Рыцарь", "Шлем Апокалипсиса"],
    prices: { rub: 18500, uah: 10000, usd: 225 },
    video: VIDEO,
  },
  {
    id: "marx-vip-003",
    title: "MARX VIP #3",
    status: "available",
    skins: ["Kar98k Снеговик", "Костюм Фантом", "M24 Золотой"],
    prices: { rub: 31000, uah: 16700, usd: 375 },
    video: VIDEO,
  },
  {
    id: "marx-vip-004",
    title: "MARX VIP #4",
    status: "available",
    skins: ["M416 Ледяной", "UMP45 Страж", "Джип Ниндзя"],
    prices: { rub: 15000, uah: 8100, usd: 182 },
    video: VIDEO,
  },
  {
    id: "marx-vip-005",
    title: "MARX VIP #5",
    status: "rented",
    skins: ["SCAR-L Пламя", "Костюм Дракон", "Дробовик Берсерк"],
    prices: { rub: 42000, uah: 22600, usd: 510 },
    video: VIDEO,
  },
  {
    id: "marx-vip-006",
    title: "MARX VIP #6",
    status: "available",
    skins: ["DP-28 Стальной", "Мотоцикл Ретро", "Очки Будущего"],
    prices: { rub: 12000, uah: 6500, usd: 146 },
    video: VIDEO,
  },
  {
    id: "marx-vip-007",
    title: "MARX VIP #7",
    status: "available",
    skins: ["AWM Фантом", "Костюм Тень", "Мотоцикл Гроза"],
    prices: { rub: 55000, uah: 29600, usd: 670 },
    video: VIDEO,
  },
  {
    id: "marx-vip-008",
    title: "MARX VIP #8",
    status: "available",
    skins: ["M16A4 Охотник", "UMP45 Механик", "Суперкары"],
    prices: { rub: 19500, uah: 10500, usd: 238 },
    video: VIDEO,
  },
];

export const CURRENCIES = [
  { code: "RUB", symbol: "₽", label: "RUB" },
  { code: "UAH", symbol: "₴", label: "UAH" },
  { code: "USD", symbol: "$", label: "USD" },
];
