import { useState, useEffect, useRef, useCallback } from "react";
import { Shield, Plus, Pencil, Trash2, ArrowLeft, Check, X, Store, Clock } from "lucide-react";
import { getAccounts, addAccount, updateAccount, deleteAccount, uploadVideo, approveAccount, rejectAccount, getAdminOrders, confirmPayment } from "../api";
import { extractPoster } from "./AccountCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const INPUT =
  "w-full rounded-xl bg-[#0A0A0A] border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-white/30 transition-all duration-200";

const NO_SPINNERS = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

import { durationLabel, durationToMs, msToDuration } from "../utils/duration";

function formatMskTime(ts) {
  if (!ts) return "—";
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

function formatDeadline(ms) {
  if (!ms) return "";
  const left = ms - Date.now();
  if (left <= 0) return "истекла";
  const min = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const CURRENCY_OPTIONS = [
  { code: "RUB", symbol: "₽" },
  { code: "UAH", symbol: "₴" },
  { code: "USD", symbol: "$" },
];

function CurrencySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = CURRENCY_OPTIONS.find((c) => c.code === value) || CURRENCY_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1 h-10 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 text-sm font-bold text-white hover:bg-white/[0.1] transition-all cursor-pointer whitespace-nowrap">
        <span>{current.symbol}</span>
        <span className="text-[10px] text-neutral-500 font-medium">{current.code}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden min-w-[80px] z-50"
          style={{ backdropFilter: "blur(24px) saturate(140%)", backgroundColor: "rgba(10,10,10,0.95)" }}>
          {CURRENCY_OPTIONS.map((c) => (
            <button key={c.code} type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-all cursor-pointer ${c.code === value ? "text-white bg-white/[0.08]" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"}`}>
              <span className="font-bold">{c.symbol}</span>
              <span className="text-xs">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Video Thumbnail Component ────────────────────────────────────────────────

function VideoThumb({ src, thumbnailUrl, className }) {
  const [poster, setPoster] = useState(null);

  useEffect(() => {
    if (thumbnailUrl) { setPoster(thumbnailUrl); return; }
    if (!src) return;
    const cacheKey = `poster-${src}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setPoster(cached); return; }
    extractPoster(src).then((url) => {
      if (url) {
        sessionStorage.setItem(cacheKey, url);
        setPoster(url);
      }
    });
  }, [src, thumbnailUrl]);

  if (poster) {
    return <img src={poster} alt="" className={className} />;
  }
  return <video src={src} preload="metadata" playsInline muted className={className} />;
}

// ─── Dynamic List Component ─────────────────────────────────────────────────

function DynamicList({ items, onChange, renderItem, addLabel }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-end gap-2 min-w-0">
          <div className="flex-1 min-w-0 overflow-hidden">{renderItem(item, i)}</div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#d44648]/20 text-neutral-500 hover:text-[#d44648] cursor-pointer transition-all duration-200">
            <X size={14} />
          </button>
        </div>
      ))}
      {addLabel && (
        <button onClick={() => onChange([...items, null])}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs text-neutral-500 hover:border-white/30 hover:text-neutral-400 transition-all duration-200 w-full justify-center cursor-pointer">
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}

// ─── Rent-specific form fields ──────────────────────────────────────────────

function RentFields({ form, setForm }) {
  const tags = form.tags || [];
  const rentTerms = form.rentTerms || [];
  const desc = form.description || { title: "", content: "" };

  return (
    <>
      {/* Tags */}
      <div>
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Теги (скины)</label>
        <DynamicList items={tags} addLabel="Добавить тег"
          onChange={(v) => setForm((f) => ({ ...f, tags: v }))}
          renderItem={(item, i) => (
            <input className={INPUT} placeholder="M416 Дракон" value={item || ""}
              onChange={(e) => { const v = [...tags]; v[i] = e.target.value; setForm((f) => ({ ...f, tags: v })); }} />
          )} />
      </div>

      {/* Rent Terms */}
      <div>
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Тарифы аренды</label>

        {/* Regular tariffs */}
        {rentTerms.filter(t => !t?.type).length > 0 && (
          <DynamicList
            items={rentTerms.filter(t => !t?.type)}
            onChange={(newItems) => {
              const specials = rentTerms.filter(t => t?.type);
              setForm((f) => ({ ...f, rentTerms: [...specials, ...newItems] }));
            }}
            renderItem={(item, i) => {
              const dur = msToDuration(item?.durationMs || 0);
              const realIndex = rentTerms.findIndex(t => t === item);
              return (
                <div className="flex flex-col md:flex-row md:items-end gap-2 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex gap-0.5 mb-1 min-w-0">
                      <span className="text-[8px] text-neutral-500 uppercase tracking-wider flex-1 text-center truncate">дни</span>
                      <span className="text-[8px] text-neutral-500 uppercase tracking-wider flex-1 text-center truncate">часы</span>
                      <span className="text-[8px] text-neutral-500 uppercase tracking-wider flex-1 text-center truncate">мин</span>
                    </div>
                    <div className="flex h-10 rounded-xl border border-white/10 overflow-hidden bg-[#0A0A0A] min-w-0">
                      <input className={`flex-1 min-w-0 w-0 bg-transparent border-r border-white/10 text-center text-xs sm:text-sm text-white outline-none ring-0 ${NO_SPINNERS}`} type="number" min="0" value={dur.d || ""}
                        onChange={(e) => { const v = [...rentTerms]; const d = msToDuration(v[realIndex]?.durationMs || 0); v[realIndex] = { ...v[realIndex], durationMs: durationToMs(Number(e.target.value), d.h, d.m) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                      <input className={`flex-1 min-w-0 w-0 bg-transparent border-r border-white/10 text-center text-xs sm:text-sm text-white outline-none ring-0 ${NO_SPINNERS}`} type="number" min="0" value={dur.h || ""}
                        onChange={(e) => { const v = [...rentTerms]; const d = msToDuration(v[realIndex]?.durationMs || 0); v[realIndex] = { ...v[realIndex], durationMs: durationToMs(d.d, Number(e.target.value), d.m) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                      <input className={`flex-1 min-w-0 w-0 bg-transparent text-center text-xs sm:text-sm text-white outline-none ring-0 ${NO_SPINNERS}`} type="number" min="0" value={dur.m || ""}
                        onChange={(e) => { const v = [...rentTerms]; const d = msToDuration(v[realIndex]?.durationMs || 0); v[realIndex] = { ...v[realIndex], durationMs: durationToMs(d.d, d.h, Number(e.target.value)) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                    </div>
                  </div>
                  <div className="flex gap-2 items-end min-w-0 md:w-auto">
                    <input className={INPUT + " w-full md:w-24 h-10 min-w-0 " + NO_SPINNERS} type="number" min="0" placeholder="Цена" value={item?.price || ""}
                      onChange={(e) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], price: Number(e.target.value) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                    <CurrencySelect value={item?.currency || "RUB"} onChange={(code) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], currency: code }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                  </div>
                </div>
              );
            }}
          />
        )}

        {/* Special tariffs */}
        {rentTerms.filter(t => t?.type === "special").length > 0 && (
          <div className="mt-3">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Специальные тарифы</label>
            <DynamicList
              items={rentTerms.filter(t => t?.type === "special")}
              onChange={(newItems) => {
                const regulars = rentTerms.filter(t => !t?.type);
                setForm((f) => ({ ...f, rentTerms: [...regulars, ...newItems] }));
              }}
              renderItem={(item, i) => {
                const realIndex = rentTerms.findIndex(t => t === item);
                return (
                  <div className="flex flex-col gap-2 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-col md:flex-row gap-2 min-w-0 overflow-hidden">
                      <input className={INPUT + " flex-1 min-w-0 w-0 " + NO_SPINNERS} type="text" placeholder="Название (Ночной)" value={item?.name || ""}
                        onChange={(e) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], name: e.target.value }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                      <div className="flex gap-1 items-center shrink-0">
                        <input className={INPUT + " min-w-0 w-0 flex-1 md:flex-none md:w-20 text-center text-xs md:text-sm " + NO_SPINNERS} type="time" value={item?.timeFrom || ""}
                          onChange={(e) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], timeFrom: e.target.value }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                        <span className="text-xs text-neutral-500 shrink-0">–</span>
                        <input className={INPUT + " min-w-0 w-0 flex-1 md:flex-none md:w-20 text-center text-xs md:text-sm " + NO_SPINNERS} type="time" value={item?.timeTo || ""}
                          onChange={(e) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], timeTo: e.target.value }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center min-w-0 overflow-hidden">
                      <input className={INPUT + " flex-1 min-w-0 w-0 " + NO_SPINNERS} type="number" min="0" placeholder="Стоимость" value={item?.price || ""}
                        onChange={(e) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], price: Number(e.target.value) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                      <CurrencySelect value={item?.currency || "RUB"} onChange={(code) => { const v = [...rentTerms]; v[realIndex] = { ...v[realIndex], currency: code }; setForm((f) => ({ ...f, rentTerms: v })); }} />
                    </div>
                  </div>
                );
              }}
            />
          </div>
        )}

        {/* Add buttons */}
        <div className="flex gap-2 mt-3">
          <button onClick={() => setForm((f) => ({ ...f, rentTerms: [...(f.rentTerms || []), { durationMs: 0, price: 0, currency: "RUB" }] }))}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs text-neutral-500 hover:border-white/30 hover:text-neutral-400 transition-all duration-200 cursor-pointer">
            <Plus size={14} /> Обычный тариф
          </button>
          <button onClick={() => setForm((f) => ({ ...f, rentTerms: [...(f.rentTerms || []), { type: "special", name: "", timeFrom: "", timeTo: "", price: 0, currency: "RUB" }] }))}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs text-neutral-500 hover:border-white/30 hover:text-neutral-400 transition-all duration-200 cursor-pointer">
            <Plus size={14} /> Спец. тариф
          </button>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Доп. информация</label>
        <input className={INPUT + " mb-2"} placeholder="Заголовок" value={desc.title}
          onChange={(e) => setForm((f) => ({ ...f, description: { ...f.description, title: e.target.value } }))} />
        <textarea className={INPUT + " min-h-[100px] resize-y"} placeholder="Описание аккаунта, скины, ранги, особенности..."
          value={desc.content}
          onChange={(e) => setForm((f) => ({ ...f, description: { ...f.description, content: e.target.value } }))} />
      </div>
    </>
  );
}

// ─── Form Screen (Add + Edit) ───────────────────────────────────────────────

function FormScreen({ account, category, onDone, onBack }) {
  const isEdit = !!account;
  const [form, setForm] = useState({
    title: account?.title || "",
    price: String(account?.price || ""),
    currency: account?.currency || "RUB",
    status: account?.status || "available",
    image_url: account?.image_url || "",
    video_url: account?.video_url || "",
    category: category,
    tags: account?.tags || [],
    rentTerms: account?.rentTerms || [],
    description: typeof account?.description === "string"
      ? { title: "", content: account.description }
      : account?.description || { title: "", content: "" },
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [videoJustUploaded, setVideoJustUploaded] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRent = form.category === "rent";

  const showToast = (msg, type = "success") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(null), 3000);
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadVideo(file);
      setForm((f) => ({ ...f, video_url: res.video_url }));
      setVideoJustUploaded(true);
      setTimeout(() => setVideoJustUploaded(false), 1500);
    } catch {
      showToast("Ошибка загрузки видео", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      const payload = {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        currency: form.currency || "RUB",
        image_url: form.image_url || "/placeholder.svg",
        video_url: form.video_url,
        category: form.category,
      };
      if (isRent) {
        payload.tags = (form.tags || []).filter(Boolean);
        payload.rentTerms = (form.rentTerms || []).filter((t) => t?.type === "special" ? (t.name && t.timeFrom && t.timeTo) : t?.durationMs > 0);
        payload.description = form.description?.title || form.description?.content ? form.description : null;
      }
      if (isEdit) {
        await updateAccount(account.id, payload);
        showToast("Сохранено!");
      } else {
        await addAccount(payload);
        showToast("Аккаунт добавлен!");
      }
      setTimeout(() => onDone(), 800);
    } catch {
      showToast("Ошибка сервера", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2.5 rounded-lg hover:bg-white/10 text-neutral-400 cursor-pointer"><ArrowLeft size={18} /></button>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{isEdit ? "Редактирование" : "Добавить аккаунт"}</h3>
      </div>
      <div className="space-y-3">
        <input className={INPUT} placeholder="Название (MARX VIP #1)" value={form.title} onChange={set("title")} />
        {!isRent && (
          <div className="flex gap-2 items-center">
            <input className={INPUT + " " + NO_SPINNERS} type="number" placeholder="Цена" value={form.price} onChange={set("price")} />
            <CurrencySelect value={form.currency} onChange={(code) => setForm((f) => ({ ...f, currency: code }))} />
          </div>
        )}
        <label className={`flex w-full items-center justify-center gap-2 rounded-xl border ${videoJustUploaded ? "border-[#4ade80]/30 bg-[#4ade80]/10" : "border-dashed border-white/20 bg-[#0A0A0A]"} px-4 py-3 text-sm cursor-pointer transition-all duration-200 ${uploading ? "text-neutral-500" : videoJustUploaded ? "text-[#4ade80]" : "text-neutral-500 hover:border-white/40"}`}>
          <input type="file" accept="video/mp4" className="hidden" onChange={handleVideoUpload} disabled={uploading} />
          {uploading ? "Загрузка..." : form.video_url ? (videoJustUploaded ? "✓ Видео загружено" : "Заменить видео (.mp4)") : "Загрузить видео (.mp4)"}
        </label>

        {isRent && <RentFields form={form} setForm={setForm} />}
      </div>
      {toast && <div className={`mt-3 rounded-xl px-4 py-2.5 ${toastType === "error" ? "bg-[#d44648]/20 border border-[#d44648]/30" : "bg-[#4ade80]/20 border border-[#4ade80]/30"}`}><p className={`text-xs text-center ${toastType === "error" ? "text-[#d44648]" : "text-[#4ade80]"}`}>{toast}</p></div>}
      <div className="mt-4 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5 cursor-pointer transition-all duration-200">Назад</button>
        <button onClick={handleSubmit} disabled={loading || !form.title.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-40 cursor-pointer transition-all duration-200">
          <Check size={16} />{loading ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Payment Queue ────────────────────────────────────────────────

function VerificationScreen({ onBack, onAccountsChanged }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = async () => {
    try {
      const res = await getAdminOrders();
      setOrders((res.orders || []).filter(o => o.status === "paid_verifying"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setInterval(load, 5000); return () => clearInterval(id); }, []);

  const handleConfirmPayment = async (id) => {
    setProcessing(id);
    try {
      await confirmPayment(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      if (onAccountsChanged) onAccountsChanged();
    } catch {}
    setProcessing(null);
  };

  const handleRelease = async (id) => {
    setProcessing(id);
    try {
      await rejectAccount(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      if (onAccountsChanged) onAccountsChanged();
    } catch {}
    setProcessing(null);
  };

  const currSymbol = (code) => ({ RUB: "₽", UAH: "₴", USD: "$" }[code] || "₽");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2.5 rounded-lg hover:bg-white/10 text-neutral-400 cursor-pointer"><ArrowLeft size={18} /></button>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Оплаты</h3>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-500">Загрузка...</p>
      ) : orders.length === 0 ? (
        <p className="text-xs text-neutral-500">Нет заказов, ожидающих оплаты</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="rounded-xl bg-[#1A1A1A] border border-[#facc15]/20 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{o.title}</p>
                  <p className="text-[11px] text-neutral-400">
                    {o.telegram_username ? `@${o.telegram_username}` : "нет юзера"} · {o.category === "rent" ? "Аренда" : "Покупка"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {o.price > 0 ? `${o.price.toLocaleString("ru-RU")} ${currSymbol(o.currency)}` : "Бесплатно"}
                  </p>
                </div>
              </div>
              {o.payment_deadline && (
                <p className="mt-2 text-[10px] text-[#facc15]">Бронь до {formatMskTime(o.payment_deadline)} МСК</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleConfirmPayment(o.id)}
                  disabled={processing === o.id}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#4ade80] py-2 text-xs font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer transition-all duration-200"
                >
                  <Check size={14} /> Оплата подтверждена
                </button>
                <button
                  onClick={() => handleRelease(o.id)}
                  disabled={processing === o.id}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-neutral-400 uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer transition-all duration-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: Cheat Check ──────────────────────────────────────────────────

function VerificationCheckScreen({ onBack, onAccountsChanged }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = async () => {
    try {
      const res = await getAdminOrders();
      setOrders((res.orders || []).filter(o => o.status === "payment_confirmed"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setInterval(load, 5000); return () => clearInterval(id); }, []);

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      await approveAccount(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      if (onAccountsChanged) onAccountsChanged();
    } catch {}
    setProcessing(null);
  };

  const handleReject = async (id) => {
    setProcessing(id);
    try {
      await rejectAccount(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      if (onAccountsChanged) onAccountsChanged();
    } catch {}
    setProcessing(null);
  };

  const currSymbol = (code) => ({ RUB: "₽", UAH: "₴", USD: "$" }[code] || "₽");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2.5 rounded-lg hover:bg-white/10 text-neutral-400 cursor-pointer"><ArrowLeft size={18} /></button>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Проверка</h3>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-500">Загрузка...</p>
      ) : orders.length === 0 ? (
        <p className="text-xs text-neutral-500">Нет аккаунтов на проверке</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="rounded-xl bg-[#1A1A1A] border border-blue-500/20 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{o.title}</p>
                  <p className="text-[11px] text-neutral-400">
                    {o.telegram_username ? `@${o.telegram_username}` : "нет юзера"} · {o.category === "rent" ? "Аренда" : "Покупка"}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {o.price > 0 ? `${o.price.toLocaleString("ru-RU")} ${currSymbol(o.currency)}` : "Бесплатно"}
                  </p>
                  {o.paid_at && (
                    <p className="text-[10px] text-neutral-500">Оплата {formatMskDate(o.paid_at)} в {formatMskTime(o.paid_at)} МСК</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleApprove(o.id)}
                  disabled={processing === o.id}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#4ade80] py-2 text-xs font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer transition-all duration-200"
                >
                  <Check size={14} /> Проверка пройдена
                </button>
                <button
                  onClick={() => handleReject(o.id)}
                  disabled={processing === o.id}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#d44648] py-2 text-xs font-bold text-white uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer transition-all duration-200"
                >
                  <X size={14} /> Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: Active Rentals ──────────────────────────────────────────────────

function ActiveRentalsScreen({ onBack, onAccountsChanged }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [timeNow, setTimeNow] = useState(Date.now());

  const load = async () => {
    try {
      const res = await getAccounts();
      setAccounts(res.accounts.filter(a => a.status === "active"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = setInterval(() => { load(); setTimeNow(Date.now()); }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleEndRental = async (id) => {
    setProcessing(id);
    try {
      await updateAccount(id, { status: "available" });
      setAccounts(prev => prev.filter(a => a.id !== id));
      if (onAccountsChanged) onAccountsChanged();
    } catch {}
    setProcessing(null);
  };

  const formatMskTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const mskOffset = 3 * 60;
    const localOffset = d.getTimezoneOffset();
    const msk = new Date(d.getTime() + (localOffset + mskOffset) * 60 * 1000);
    const hh = String(msk.getUTCHours()).padStart(2, "0");
    const mm = String(msk.getUTCMinutes()).padStart(2, "0");
    const dd = String(msk.getUTCDate()).padStart(2, "0");
    const MM = String(msk.getUTCMonth() + 1).padStart(2, "0");
    const now = new Date();
    const nowMsk = new Date(now.getTime() + (now.getTimezoneOffset() + mskOffset) * 60 * 1000);
    const isToday = msk.getUTCFullYear() === nowMsk.getUTCFullYear() &&
      msk.getUTCMonth() === nowMsk.getUTCMonth() &&
      msk.getUTCDate() === nowMsk.getUTCDate();
    if (isToday) return `до ${hh}:${mm}`;
    return `до ${hh}:${mm} (${dd}.${MM})`;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-2.5 rounded-lg hover:bg-white/10 text-neutral-400 cursor-pointer"><ArrowLeft size={18} /></button>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Активные аренды</h3>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-500">Загрузка...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-neutral-500">Нет активных аренд</p>
      ) : (
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-white/5 p-3">
              {a.thumbnail_url ? (
                <img src={a.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-neutral-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{a.title}</p>
                <p className="text-[11px] text-[#4ade80]">
                  {a.telegram_username ? `@${a.telegram_username}` : (a.order_id ? `Заказ ${a.order_id.slice(-8)}` : "")}
                </p>
                <p className="text-[11px] text-neutral-500">{formatMskTime(a.rent_expires_at)} МСК</p>
              </div>
              <button
                onClick={() => handleEndRental(a.id)}
                disabled={processing === a.id}
                className="px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-neutral-400 uppercase tracking-wider hover:bg-[#d44648]/20 hover:border-[#d44648]/30 hover:text-[#d44648] active:scale-[0.98] transition-all duration-200 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {processing === a.id ? "..." : "Завершить"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen: Account List ────────────────────────────────────────────────────

function ListScreen({ category, onEdit, onAdd, onAccountsChanged }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const label = category === "rent" ? "Аренда" : "Магазин";

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAccounts();
      setAccounts(res.accounts.filter((a) => a.category === category));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [category]);

  const confirmDeleteAction = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount(confirmDelete.id);
      setAccounts((prev) => prev.filter((a) => a.id !== confirmDelete.id));
      if (onAccountsChanged) onAccountsChanged();
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{label} — каталог</h3>
        <button onClick={onAdd} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 cursor-pointer transition-all duration-200">
          <Plus size={14} /> Добавить
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-neutral-500">Загрузка...</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-neutral-500">Аккаунтов пока нет</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-white/5 p-3">
              {a.image_url && a.image_url !== "/placeholder.svg" ? (
                <img src={a.image_url} alt="" className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              ) : a.video_url ? (
                <VideoThumb src={a.video_url.startsWith("http") ? a.video_url : API_URL + a.video_url} thumbnailUrl={a.thumbnail_url} className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              ) : (
                <img src="/placeholder.svg" alt="" className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{a.title}</p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {({ "available": "В наличии", "active": "Активен", "waiting_payment": "Ожидает оплаты", "paid_verifying": "На проверке", "busy": "Занят" }[a.status] || a.status)} {a.category !== "rent" && a.price ? `${(a.price || 0).toLocaleString("ru-RU")} ₽` : ""}
                </p>
              </div>
              <button onClick={() => onEdit(a)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white shrink-0 cursor-pointer transition-all duration-200">
                <Pencil size={16} />
              </button>
              <button onClick={() => setConfirmDelete({ id: a.id, title: a.title })} className="p-2 rounded-lg hover:bg-[#d44648]/20 text-neutral-500 hover:text-[#d44648] shrink-0 cursor-pointer transition-all duration-200">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
            <p className="text-sm font-bold text-white text-center">Удалить «{confirmDelete.title}»?</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5 cursor-pointer transition-all duration-200">Отмена</button>
              <button onClick={confirmDeleteAction} disabled={deleting}
                className="flex-1 rounded-xl bg-[#d44648] py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98] disabled:opacity-50 cursor-pointer transition-all duration-200">{deleting ? "Удаление..." : "Удалить"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminPanel ─────────────────────────────────────────────────────────

const ADMIN_USERNAME = "verykindandfriendlyguy";

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch { return null; }
}

export default function AdminPanel({ onAccountsChanged }) {
  const tgUser = getTelegramUser();
  if (!tgUser || tgUser.username !== ADMIN_USERNAME) {
    return (
      <div className="mx-2 sm:mx-4 mt-6 rounded-2xl border border-white/5 bg-[#1A1A1A] p-6 text-center">
        <Shield size={24} className="mx-auto mb-3 text-neutral-600" />
        <p className="text-sm text-neutral-500">Доступ запрещён</p>
        <p className="text-[10px] text-neutral-600 mt-1">Только для администратора</p>
      </div>
    );
  }
  const [view, setView] = useState("list");
  const [activeTab, setActiveTab] = useState("rent");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const tabsRef = useRef(null);
  const tabsDragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });
  const [tabsMask, setTabsMask] = useState("");

  const updateTabsFades = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) { setTabsMask(""); return; }
    const left = Math.min(50, el.scrollLeft);
    const right = Math.min(50, maxScroll - el.scrollLeft);
    setTabsMask(`linear-gradient(to right, transparent 0%, black ${left}px, black calc(100% - ${right}px), transparent 100%)`);
  }, []);

  const handleAccountsChanged = () => {
    if (onAccountsChanged) onAccountsChanged();
  };

  return (
    <div className="mx-2 sm:mx-4 mt-6 rounded-2xl border border-white/5 bg-[#1A1A1A] p-3 sm:p-4 overflow-x-hidden">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">Панель управления</h3>
          <p className="text-[10px] text-neutral-500 tracking-wider uppercase">MARX SHOP — Admin</p>
        </div>
      </div>

      {/* Tabs */}
      {view === "list" && (
        <div className="relative mb-4 -mx-1 px-1">
          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto cursor-grab active:cursor-grabbing"
            onScroll={updateTabsFades}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              maskImage: tabsMask || "none",
              WebkitMaskImage: tabsMask || "none",
            }}
            onMouseDown={(e) => { const el = tabsRef.current; if (!el) return; tabsDragState.current = { isDragging: true, startX: e.pageX, scrollLeft: el.scrollLeft }; el.style.scrollBehavior = "auto"; }}
            onMouseLeave={() => { tabsDragState.current.isDragging = false; tabsRef.current && (tabsRef.current.style.scrollBehavior = ""); }}
            onMouseUp={() => { tabsDragState.current.isDragging = false; tabsRef.current && (tabsRef.current.style.scrollBehavior = ""); }}
            onMouseMove={(e) => { if (!tabsDragState.current.isDragging) return; e.preventDefault(); const el = tabsRef.current; if (!el) return; el.scrollLeft = tabsDragState.current.scrollLeft - (e.pageX - tabsDragState.current.startX); }}
          >
            <button onClick={() => setActiveTab("rent")}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${activeTab === "rent" ? "bg-white text-black" : "bg-white/5 text-neutral-500 hover:bg-white/10"}`}>
              <Clock size={14} /> Аренда
            </button>
            <button onClick={() => setActiveTab("shop")}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${activeTab === "shop" ? "bg-white text-black" : "bg-white/5 text-neutral-500 hover:bg-white/10"}`}>
              <Store size={14} /> Магазин
            </button>
            <button onClick={() => setActiveTab("active")}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${activeTab === "active" ? "bg-[#4ade80] text-black" : "bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"}`}>
              <Check size={14} /> Активные
            </button>
            <button onClick={() => setActiveTab("verify")}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${activeTab === "verify" ? "bg-[#facc15] text-black" : "bg-[#facc15]/20 text-[#facc15] hover:bg-[#facc15]/30"}`}>
              <Shield size={14} /> Оплаты
            </button>
            <button onClick={() => setActiveTab("check")}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${activeTab === "check" ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"}`}>
              <Shield size={14} /> Проверка
            </button>
          </div>
        </div>
      )}

      {view === "list" && activeTab !== "verify" && activeTab !== "active" && activeTab !== "check" && (
        <ListScreen
          category={activeTab === "shop" ? "sale" : "rent"}
          onAdd={() => setView("add")}
          onEdit={(account) => { setSelectedAccount(account); setView("edit"); }}
          onAccountsChanged={handleAccountsChanged}
        />
      )}
      {view === "add" && (
        <FormScreen category={activeTab === "shop" ? "sale" : "rent"}
          onDone={() => { handleAccountsChanged(); setView("list"); }}
          onBack={() => setView("list")} />
      )}
      {view === "edit" && selectedAccount && (
        <FormScreen account={selectedAccount} category={selectedAccount.category}
          onDone={() => { handleAccountsChanged(); setView("list"); }}
          onBack={() => setView("list")} />
      )}
      {view === "list" && activeTab === "verify" && (
        <VerificationScreen
          onBack={() => setActiveTab("rent")}
          onAccountsChanged={handleAccountsChanged}
        />
      )}
      {view === "list" && activeTab === "check" && (
        <VerificationCheckScreen
          onBack={() => setActiveTab("rent")}
          onAccountsChanged={handleAccountsChanged}
        />
      )}
      {view === "list" && activeTab === "active" && (
        <ActiveRentalsScreen
          onBack={() => setActiveTab("rent")}
          onAccountsChanged={handleAccountsChanged}
        />
      )}
    </div>
  );
}
