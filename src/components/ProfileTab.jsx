import { useState, useEffect, useCallback } from "react";
import { User } from "lucide-react";
import AdminPanel from "./AdminPanel";
import { getMyAccounts } from "../api";

function formatCountdown(ms) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, "0")}м ${String(s).padStart(2, "0")}с`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMskTime(ts) {
  if (!ts) return "--:--";
  const d = new Date(ts);
  const mskOffset = 3 * 60;
  const localOffset = d.getTimezoneOffset();
  const msk = new Date(d.getTime() + (localOffset + mskOffset) * 60 * 1000);
  return `${String(msk.getUTCHours()).padStart(2, "0")}:${String(msk.getUTCMinutes()).padStart(2, "0")}`;
}

function getTgUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch { return null; }
}

function checkIsAdmin(user) {
  if (!user) return false;
  return user.username === "verykindandfriendlyguy";
}

// ─── User's Accounts List ────────────────────────────────────────────────────

function UserAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeNow, setTimeNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await getMyAccounts();
      setAccounts(res.accounts || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => { load(); setTimeNow(Date.now()); }, 3000);
    return () => clearInterval(id);
  }, [load]);

  const statusColors = {
    waiting_payment: "text-yellow-400",
    paid_verifying: "text-blue-400",
    active: "text-green-400",
  };

  const statusLabels = {
    waiting_payment: "Ожидает оплаты",
    paid_verifying: "На проверке",
    active: "Аренда активна",
  };

  return (
    <div className="mx-4 mt-6 rounded-2xl border border-white/5 bg-[#1A1A1A] p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <User size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">Мои аккаунты</h3>
          <p className="text-[10px] text-neutral-500 tracking-wider uppercase">Купленные и арендованные</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Загрузка...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-neutral-500">У вас пока нет аккаунтов</p>
      ) : (
        <div className="space-y-3">
          {accounts.map(a => (
            <div key={a.id} className="rounded-xl bg-[#0A0A0A] border border-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{a.title}</p>
                  <p className={`text-[10px] mt-0.5 ${statusColors[a.status] || "text-neutral-500"}`}>
                    {statusLabels[a.status] || a.status}
                  </p>
                </div>
                {a.thumbnail_url && (
                  <img src={a.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover ml-3" />
                )}
              </div>

              {a.status === "active" && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <p className="text-sm text-neutral-300 text-center">
                      Модератор свяжется с вами для передачи данных
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Осталось времени</p>
                    <p className="text-xl font-bold text-white tabular-nums">
                      {a.rent_expires_at ? formatCountdown(Math.max(0, a.rent_expires_at - timeNow)) : "—"}
                    </p>
                    <p className="text-[10px] text-neutral-500">До {formatMskTime(a.rent_expires_at)} МСК</p>
                  </div>
                </div>
              )}

              {a.status === "waiting_payment" && (
                <p className="mt-2 text-[10px] text-yellow-400">Ожидает оплаты</p>
              )}

              {a.status === "paid_verifying" && (
                <p className="mt-2 text-[10px] text-blue-400">Оплата получена. Ожидаем проверки модератором.</p>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ─── Main ProfileTab ─────────────────────────────────────────────────────────

export default function ProfileTab({ onAccountsChanged }) {
  const tgUser = getTgUser();
  const isAdmin = checkIsAdmin(tgUser);

  if (isAdmin) {
    return <AdminPanel onAccountsChanged={onAccountsChanged} />;
  }

  return <UserAccounts />;
}
