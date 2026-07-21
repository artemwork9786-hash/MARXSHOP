import { useState, useEffect, useCallback } from "react";
import { payForAccount, testPay, getOrderStatus } from "../api";
import { convertPrice } from "../utils/currency";

const CURRENCIES = [
  { code: "RUB", symbol: "₽" },
  { code: "UAH", symbol: "грн" },
  { code: "USD", symbol: "$" },
];

function formatMskTime(ts) {
  if (!ts) return "--:--";
  const d = new Date(ts);
  const mskOffset = 3 * 60;
  const localOffset = d.getTimezoneOffset();
  const msk = new Date(d.getTime() + (localOffset + mskOffset) * 60 * 1000);
  return `${String(msk.getUTCHours()).padStart(2, "0")}:${String(msk.getUTCMinutes()).padStart(2, "0")}`;
}

function formatMskDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mskOffset = 3 * 60;
  const localOffset = d.getTimezoneOffset();
  const msk = new Date(d.getTime() + (localOffset + mskOffset) * 60 * 1000);
  const dd = String(msk.getUTCDate()).padStart(2, "0");
  const mm = String(msk.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, "0")}м ${String(s).padStart(2, "0")}с`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
    </div>
  );
}

function WaitingPaymentScreen({ account, currency, rates, selectedTerm, onConfirmPay, onCancel }) {
  const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
  const isRent = account.category === "rent";
  const price = isRent ? (selectedTerm?.price || 0) : (account.price || 0);
  const fromCur = isRent ? (selectedTerm?.currency || "RUB") : (account.currency || "RUB");
  const displayPrice = convertPrice(price, fromCur, currency, rates);
  const deadline = account.payment_deadline || null;

  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Ожидание оплаты</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Аккаунт <span className="text-white font-semibold truncate">{account.title}</span> забронирован
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{displayPrice} {curr.symbol}</p>
        </div>

        <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm text-neutral-300 leading-relaxed text-center">
            Оплатите через Telegram-бот и вернитесь нажать «Я оплатил»
          </p>
        </div>

        {deadline && (
          <p className="mt-3 text-center text-[11px] text-yellow-400 font-medium">
            У вас 10 минут — после этого бронь сгорит
          </p>
        )}

        <div className="mt-6">
          <button
            onClick={onConfirmPay}
            className="w-full rounded-xl bg-yellow-500 py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] cursor-pointer"
          >
            Я оплатил
          </button>
        </div>
      </div>
    </div>
  );
}

function PaidVerifyingScreen({ account, onBack }) {
  const paidAt = account.paid_at || Date.now();
  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
        <button onClick={onBack} className="mb-4 text-sm text-neutral-400 hover:text-white cursor-pointer">&larr; Назад</button>
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Ждём подтверждения оплаты</h2>
          <p className="mt-2 text-sm text-neutral-400">Модератор проверит платёж и подтвердит</p>
          <p className="mt-1 text-xs text-neutral-500">Оплата {formatMskDate(paidAt)} в {formatMskTime(paidAt)} МСК</p>
        </div>

        <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Все аккаунты проверяются модератором на наличие запрещённых программ.
            Время проверки — до 24 часов.
          </p>
        </div>

        <div className="mt-4 text-center">
          <a
            href="https://t.me/verykindandfriendlyguy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            Написать модератору
          </a>
        </div>
      </div>
    </div>
  );
}

function ActiveScreen({ account, currency, rates, onBack }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  useEffect(() => {
    if (!account.rent_expires_at) return;
    const update = () => setTimeLeft(Math.max(0, account.rent_expires_at - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [account.rent_expires_at]);

  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-green-500/30 bg-[#1A1A1A] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-green-400">Аренда активна</h2>
          <p className="mt-1 text-sm text-neutral-400">{account.title}</p>
        </div>

        <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm text-neutral-300 leading-relaxed text-center">
            Модератор свяжется с вами для передачи данных от аккаунта
          </p>
        </div>

        <div className="mt-4 text-center">
          <a
            href="https://t.me/verykindandfriendlyguy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98]"
          >
            Написать модератору
          </a>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Осталось времени</p>
          <p className="text-3xl font-bold text-white tabular-nums mt-1">{formatCountdown(timeLeft)}</p>
          <p className="text-[10px] text-neutral-500 mt-1">До {formatMskTime(account.rent_expires_at)} МСК</p>
        </div>
      </div>
    </div>
  );
}

function RejectedScreen({ account, onBack }) {
  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-red-500/30 bg-[#1A1A1A] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-red-400">Заявка отклонена</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Аккаунт <span className="text-white font-semibold truncate">{account.title}</span> не прошёл проверку.
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Причина: обнаружены запрещённые программы. Свяжитесь с модератором для уточнения.
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-6 w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98] cursor-pointer"
        >
          Вернуться в каталог
        </button>
      </div>
    </div>
  );
}

export default function PaymentFlow({ account, currency, rates, onBack, onStatusChange, selectedTerm, onSelectTerm }) {
  const normalizeStatus = (s) => {
    if (s === "В наличии" || s === "Занят") return "available";
    return s;
  };
  const [status, setStatus] = useState(normalizeStatus(account.status));
  const [prevStatus, setPrevStatus] = useState(null);
  const [rejected, setRejected] = useState(false);
  const [liveAccount, setLiveAccount] = useState(account);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Tick for countdown timers
  useEffect(() => {
    if (status !== "payment_confirmed" && status !== "active") return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      await payForAccount(account.id);
      setStatus("waiting_payment");
    } catch (err) {
      console.error("Pay failed:", err);
      setError("Не удалось начать оплату. Попробуйте ещё раз.");
    }
    setLoading(false);
  };

  const handleConfirmPay = async () => {
    setLoading(true);
    setError(null);
    // Optimistic: show PaidVerifyingScreen immediately
    setStatus("paid_verifying");
    try {
      await testPay(account.id);
    } catch (err) {
      console.error("Confirm pay failed:", err);
      // Revert on error
      setError("Не удалось подтвердить оплату. Попробуйте ещё раз.");
      setStatus("waiting_payment");
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    setStatus("available");
    onBack();
  };

  const handleStatusRefresh = useCallback(async () => {
    try {
      const res = await getOrderStatus(account.id);
      setLiveAccount(prev => ({ ...prev, ...res }));
      if (res.status !== status) {
        const wasPending = status === "paid_verifying" || status === "waiting_payment" || status === "payment_confirmed";
        const isRejected = wasPending && res.status === "available";
        setPrevStatus(status);
        setStatus(res.status);
        if (isRejected) setRejected(true);
        onStatusChange?.();
      }
    } catch {}
  }, [account.id, status, onStatusChange]);

  // Polling: check status every 5 seconds when pending
  useEffect(() => {
    if (status !== "paid_verifying" && status !== "waiting_payment" && status !== "payment_confirmed") return;
    const id = setInterval(handleStatusRefresh, 5000);
    return () => clearInterval(id);
  }, [status, handleStatusRefresh]);

  // If account is available, show pay button
  if (status === "available") {
    const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const isRent = account.category === "rent";
    const price = isRent ? (selectedTerm?.price || 0) : (account.price || 0);
    const fromCur = isRent ? (selectedTerm?.currency || "RUB") : (account.currency || "RUB");
    const displayPrice = convertPrice(price, fromCur, currency, rates);

    return (
      <div className="px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
          <button onClick={onBack} className="mb-4 text-sm text-neutral-400 hover:text-white cursor-pointer">&larr; Назад</button>
          <h2 className="text-lg font-bold text-white">{account.title}</h2>
          {isRent && selectedTerm && (
            <p className="mt-1 text-sm text-neutral-400">{selectedTerm.label}</p>
          )}
          {price > 0 && (
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white truncate">{displayPrice} {curr.symbol}</p>
          )}
          {error && <p className="mt-3 text-sm text-red-400 text-center">{error}</p>}
          <button
            onClick={handlePay}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Обработка..." : "Оплатить"}
          </button>
        </div>
      </div>
    );
  }

  if (rejected || (prevStatus && (prevStatus === "paid_verifying" || prevStatus === "waiting_payment") && status === "available")) {
    return <RejectedScreen account={account} onBack={onBack} />;
  }

  if (status === "waiting_payment") {
    return <WaitingPaymentScreen account={account} currency={currency} rates={rates} selectedTerm={selectedTerm} onConfirmPay={handleConfirmPay} onCancel={handleCancel} />;
  }

  if (status === "paid_verifying") {
    return <PaidVerifyingScreen account={account} onBack={onBack} />;
  }

  if (status === "payment_confirmed") {
    const confirmedAt = liveAccount.confirmed_at || Date.now();
    const deadlineMs = confirmedAt + 60 * 60 * 1000;
    const timeLeft = Math.max(0, deadlineMs - Date.now());

    return (
      <div className="px-4 py-6">
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Оплата подтверждена</h2>
            <p className="mt-2 text-sm text-neutral-400">Напишите модератору для проверки на читы</p>
            <p className="mt-1 text-[11px] text-neutral-500">Без проверки доступ не будет выдан</p>
          </div>

          {timeLeft > 0 && (
            <p className="mt-3 text-center text-[11px] text-yellow-400 font-medium">
              Напишите модератору в течение {formatCountdown(timeLeft)}
            </p>
          )}

          <div className="mt-4 text-center">
            <a
              href="https://t.me/verykindandfriendlyguy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98]"
            >
              Написать модератору
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === "active") {
    return <ActiveScreen account={liveAccount} currency={currency} rates={rates} onBack={onBack} />;
  }

  // Fallback: unknown status
  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
        <button onClick={onBack} className="mb-4 text-sm text-neutral-400 hover:text-white cursor-pointer">&larr; Назад</button>
        <div className="text-center">
          <p className="text-sm text-neutral-400">Статус заказа: {status}</p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
