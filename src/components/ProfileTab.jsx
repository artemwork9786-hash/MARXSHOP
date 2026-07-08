import { User, Clock, AlertTriangle, Store, CheckCircle, Copy, CreditCard, ExternalLink } from "lucide-react";
import { CURRENCIES } from "../data/accounts";
import AdminPanel from "./AdminPanel";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getTgUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

function checkIsAdmin(user) {
  if (!user) return true;
  return user.username === "verykindandfriendlyguy";
}

function handleCopy(text) {
  navigator.clipboard.writeText(text);
}

// ─── Payment Method Selector ──────────────────────────────────────────────────

function PaymentMethodSelector({ onSelect }) {
  return (
    <div className="px-4 pt-6 pb-6">
      <h2 className="text-lg font-bold text-white tracking-wide text-center mb-4">
        Выберите способ оплаты
      </h2>
      <div className="space-y-3">
        <button
          onClick={() => onSelect("crypto")}
          className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 text-left transition-all hover:border-white/20 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-900/30">
            <ExternalLink size={22} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Криптовалюта (CryptoBot)</p>
            <p className="mt-0.5 text-xs text-neutral-500">Оплата через Telegram CryptoBot</p>
          </div>
        </button>
        <button
          onClick={() => onSelect("sbp")}
          className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 text-left transition-all hover:border-white/20 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-900/30">
            <CreditCard size={22} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Система быстрых платежей (СБП)</p>
            <p className="mt-0.5 text-xs text-neutral-500">Перевод на карту по QR-коду</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Crypto Payment View (redirected to CryptoBot) ───────────────────────────

function CryptoPaymentView({ activeOrder, paymentTimer, currency }) {
  const curr = CURRENCIES.find((c) => c.code === currency);
  const price = activeOrder.prices[currency.toLowerCase()];
  const formattedPrice = price.toLocaleString("ru-RU");
  const isExpired = paymentTimer <= 0;

  if (isExpired) {
    return (
      <div className="flex flex-col items-center px-4 pt-10 pb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-white tracking-wide">
          Время оплаты истекло!
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Бронь автоматически снята. Выберите аккаунт заново в Магазине.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900/30">
            <ExternalLink size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-blue-400">
              Оплата через CryptoBot
            </p>
            <h2 className="text-sm font-bold text-white">
              Аренда: {activeOrder.title}
            </h2>
          </div>
        </div>
        <div className="mt-5 border-t border-neutral-800 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Сумма к оплате</span>
            <span className="text-lg font-bold text-white">
              {formattedPrice} {curr.symbol}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-[#1A1A1A] p-6">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">
          Осталось времени
        </p>
        <div className="mt-2 text-5xl font-bold tabular-nums text-white tracking-widest">
          {formatTime(paymentTimer)}
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-white transition-all duration-1000"
            style={{ width: `${(paymentTimer / 600) * 100}%` }}
          />
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          Откроется страница оплаты в CryptoBot.
          <br />
          После оплаты статус обновится автоматически.
        </p>
      </div>
    </div>
  );
}

// ─── SBP Payment View ────────────────────────────────────────────────────────

function SbpPaymentView({ activeOrder, paymentDetails, paymentTimer }) {
  const isExpired = paymentTimer <= 0;

  if (isExpired) {
    return (
      <div className="flex flex-col items-center px-4 pt-10 pb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-white tracking-wide">
          Время оплаты истекло!
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Бронь автоматически снята. Выберите аккаунт заново в Магазине.
        </p>
      </div>
    );
  }

  if (!paymentDetails) return null;

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-900/30">
            <CreditCard size={20} className="text-green-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-green-400">
              Оплата через СБП
            </p>
            <h2 className="text-sm font-bold text-white">
              Аренда: {activeOrder.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-bold text-white mb-4">
          Данные для перевода
        </h3>

        {/* Recipient */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Получатель</p>
              <p className="text-sm text-white">{paymentDetails.recipientName}</p>
            </div>
            <button
              onClick={() => handleCopy(paymentDetails.recipientName)}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Card Number */}
          <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Номер карты</p>
              <p className="text-sm font-mono text-white">{paymentDetails.cardNumber}</p>
            </div>
            <button
              onClick={() => handleCopy(paymentDetails.cardNumber.replace(/\s/g, ""))}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Сумма</p>
              <p className="text-sm font-bold text-white">{paymentDetails.amount.toLocaleString("ru-RU")} ₽</p>
            </div>
            <button
              onClick={() => handleCopy(String(paymentDetails.amount))}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Comment */}
          <div className="flex items-center justify-between rounded-xl bg-yellow-900/20 border border-yellow-900/30 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-yellow-500/80">Комментарий (обязательно)</p>
              <p className="text-sm font-mono font-bold text-yellow-400">{paymentDetails.comment}</p>
            </div>
            <button
              onClick={() => handleCopy(paymentDetails.comment)}
              className="text-yellow-500/80 hover:text-yellow-400 transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-neutral-800/30 px-4 py-3">
          <p className="text-xs text-neutral-500 leading-relaxed">
            1. Откройте приложение банка
            <br />
            2. Переведите точную сумму на указанную карту
            <br />
            3. Укажите комментарий к переводу
            <br />
            4. Нажмите "Я оплатил" внизу экрана
          </p>
        </div>
      </div>

      {/* Timer */}
      <div className="mt-4 flex flex-col items-center rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">
          Осталось времени
        </p>
        <div className="mt-2 text-4xl font-bold tabular-nums text-white tracking-widest">
          {formatTime(paymentTimer)}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-white transition-all duration-1000"
            style={{ width: `${(paymentTimer / 600) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Awaiting Verification View ──────────────────────────────────────────────

function AwaitingVerificationView({ activeOrder, currency }) {
  const curr = CURRENCIES.find((c) => c.code === currency);
  const price = activeOrder.prices[currency.toLowerCase()];
  const formattedPrice = price.toLocaleString("ru-RU");

  return (
    <div className="flex flex-col items-center px-4 pt-10 pb-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-900/30">
        <Clock size={32} className="text-yellow-500" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-white tracking-wide">
        Ожидает подтверждения
      </h2>
      <p className="mt-2 text-center text-sm text-neutral-500">
        Ваш платёж на сумму {formattedPrice} {curr.symbol} обрабатывается.
        <br />
        После подтверждения данныe для входа появятся здесь.
      </p>
    </div>
  );
}

// ─── Paid View ───────────────────────────────────────────────────────────────

function PaidView({ activeOrder, currency }) {
  const curr = CURRENCIES.find((c) => c.code === currency);
  const price = activeOrder.prices[currency.toLowerCase()];
  const formattedPrice = price.toLocaleString("ru-RU");

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-900/30">
            <CheckCircle size={20} className="text-green-500" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-green-500">
              Оплачено
            </p>
            <h2 className="text-sm font-bold text-white">
              Аренда: {activeOrder.title}
            </h2>
          </div>
        </div>
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Сумма</span>
            <span className="text-sm font-bold text-white">
              {formattedPrice} {curr.symbol}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-bold text-white mb-3">
          Данные для входа
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Логин</p>
              <p className="text-sm font-mono text-white">{activeOrder.title.toLowerCase().replace(/ /g, "")}@marx.shop</p>
            </div>
            <button
              onClick={() => handleCopy(`${activeOrder.title.toLowerCase().replace(/ /g, "")}@marx.shop`)}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Пароль</p>
              <p className="text-sm font-mono text-white">marx{activeOrder.id.slice(-3)}2024!</p>
            </div>
            <button
              onClick={() => handleCopy(`marx${activeOrder.id.slice(-3)}2024!`)}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-yellow-900/20 border border-yellow-900/30 px-4 py-3">
          <p className="text-xs text-yellow-500/80 leading-relaxed">
            Смените пароль сразу после входа. Не передавайте данные третьим лицам.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Empty Profile ───────────────────────────────────────────────────────────

function EmptyProfile() {
  const user = getTgUser();
  const hasUser = !!user;
  const isAdmin = checkIsAdmin(user);
  const displayName = hasUser
    ? user.first_name + (user.username ? ` @${user.username}` : "")
    : "Гость";

  if (isAdmin) {
    return (
      <div className="px-4 pt-6 pb-6">
        <AdminPanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 pt-10 pb-6">
      {hasUser && user.photo_url ? (
        <img
          src={user.photo_url}
          alt="avatar"
          className="h-20 w-20 rounded-full object-cover border-2 border-neutral-700"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-800">
          <User size={36} className="text-neutral-500" />
        </div>
      )}
      <h2 className="mt-4 text-lg font-bold text-white tracking-wide">
        {displayName}
      </h2>
      {!hasUser && (
        <>
          <p className="mt-1 text-xs text-neutral-500">
            Войдите через Telegram, чтобы управлять арендами
          </p>
          <button className="mt-6 rounded-xl bg-white px-8 py-3 text-sm font-bold text-black uppercase tracking-wider transition-all hover:bg-neutral-200 active:scale-95">
            Войти через Telegram
          </button>
        </>
      )}

      <div className="mt-10 flex flex-col items-center rounded-2xl border border-white/5 bg-[#1A1A1A] p-6">
        <Store size={28} className="text-neutral-600" />
        <p className="mt-3 text-center text-sm text-neutral-500">
          У вас нет активных заказов.
          <br />
          Перейдите в Магазин, чтобы арендовать аккаунт.
        </p>
      </div>
    </div>
  );
}

// ─── Main ProfileTab ─────────────────────────────────────────────────────────

export default function ProfileTab({
  activeOrder,
  paymentTimer,
  currency,
  orderStatus,
  paymentMethod,
  payUrl,
  paymentDetails,
  onSelectMethod,
  onClearOrder,
}) {
  // No active order — show empty profile
  if (!activeOrder) {
    return <EmptyProfile />;
  }

  // Payment method not yet chosen — show selector
  if (!paymentMethod && orderStatus === null) {
    return <PaymentMethodSelector onSelect={onSelectMethod} />;
  }

  // Paid — show credentials
  if (orderStatus === "paid") {
    return <PaidView activeOrder={activeOrder} currency={currency} />;
  }

  // Awaiting verification (SBP)
  if (orderStatus === "awaiting_verification") {
    return <AwaitingVerificationView activeOrder={activeOrder} currency={currency} />;
  }

  // Pending — show appropriate payment view
  if (orderStatus === "pending") {
    if (paymentMethod === "crypto") {
      return (
        <CryptoPaymentView
          activeOrder={activeOrder}
          paymentTimer={paymentTimer}
          currency={currency}
        />
      );
    }
    if (paymentMethod === "sbp") {
      return (
        <SbpPaymentView
          activeOrder={activeOrder}
          paymentDetails={paymentDetails}
          paymentTimer={paymentTimer}
        />
      );
    }
  }

  return <EmptyProfile />;
}
