import { useState } from "react";
import { Shield, Plus } from "lucide-react";
import { addAccount } from "../api";

const INPUT_STYLE =
  "w-full rounded-xl bg-[#0A0A0A] border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-white/30 transition-colors";

export default function AdminPanel() {
  const [form, setForm] = useState({
    title: "",
    rank: "",
    priceRub: "",
    priceUah: "",
    priceUsd: "",
    videoUrl: "",
    skins: "",
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    setToast(null);

    const newAccount = {
      id: `marx-vip-${Date.now()}`,
      title: form.title.trim(),
      rank: form.rank.trim() || null,
      status: "available",
      skins: form.skins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      prices: {
        rub: Number(form.priceRub) || 0,
        uah: Number(form.priceUah) || 0,
        usd: Number(form.priceUsd) || 0,
      },
      video: form.videoUrl.trim() || "/sample-video.mp4",
    };

    try {
      await addAccount(newAccount);

      setForm({
        title: "",
        rank: "",
        priceRub: "",
        priceUah: "",
        priceUsd: "",
        videoUrl: "",
        skins: "",
      });
      setToast("Аккаунт успешно добавлен в каталог!");
    } catch {
      setToast("Ошибка сервера. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-4 mt-6 rounded-2xl border border-white/5 bg-[#1A1A1A] p-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">
            Панель управления
          </h3>
          <p className="text-[10px] text-neutral-500 tracking-wider uppercase">
            MARX SHOP — Admin
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Название аккаунта (MARX VIP #3)"
          value={form.title}
          onChange={set("title")}
          className={INPUT_STYLE}
        />
        <input
          type="text"
          placeholder="Ранг (Завоеватель)"
          value={form.rank}
          onChange={set("rank")}
          className={INPUT_STYLE}
        />

        {/* Prices row */}
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder="RUB"
            value={form.priceRub}
            onChange={set("priceRub")}
            className={INPUT_STYLE}
          />
          <input
            type="number"
            placeholder="UAH"
            value={form.priceUah}
            onChange={set("priceUah")}
            className={INPUT_STYLE}
          />
          <input
            type="number"
            placeholder="USD"
            value={form.priceUsd}
            onChange={set("priceUsd")}
            className={INPUT_STYLE}
          />
        </div>

        <input
          type="url"
          placeholder="Ссылка на видеообзор (.mp4)"
          value={form.videoUrl}
          onChange={set("videoUrl")}
          className={INPUT_STYLE}
        />
        <textarea
          placeholder="Ключевые скины через запятую"
          value={form.skins}
          onChange={set("skins")}
          rows={2}
          className={INPUT_STYLE + " resize-none"}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="mt-3 rounded-xl bg-green-900/30 border border-green-900/40 px-4 py-2.5">
          <p className="text-xs text-green-400 text-center">{toast}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !form.title.trim()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
      >
        <Plus size={16} />
        {loading ? "Отправка..." : "Опубликовать аккаунт"}
      </button>
    </div>
  );
}
