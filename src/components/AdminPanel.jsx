import { useState, useEffect } from "react";
import { Shield, Plus, List, Pencil, Trash2, ArrowLeft, Check } from "lucide-react";
import { getAccounts, addAccount, updateAccount, deleteAccount, uploadVideo } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const INPUT =
  "w-full rounded-xl bg-[#0A0A0A] border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-white/30 transition-colors";

// ─── Screen: Add Account ─────────────────────────────────────────────────────

function AddScreen({ onDone }) {
  const [form, setForm] = useState({
    title: "", price: "", status: "В наличии",
    image_url: "", video_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadVideo(file);
      setForm((f) => ({ ...f, video_url: res.video_url }));
      setToast("Видео загружено!");
    } catch {
      setToast("Ошибка загрузки видео");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      await addAccount({
        title: form.title.trim(),
        price: Number(form.price) || 0,
        status: form.status,
        image_url: form.image_url.trim() || "/placeholder.svg",
        video_url: form.video_url,
      });
      setToast("Аккаунт добавлен!");
      setTimeout(() => onDone(), 800);
    } catch {
      setToast("Ошибка сервера");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-4">Добавить аккаунт</h3>
      <div className="space-y-3">
        <input className={INPUT} placeholder="Название (MARX VIP #1)" value={form.title} onChange={set("title")} />
        <input className={INPUT} type="number" placeholder="Цена аренды (₽)" value={form.price} onChange={set("price")} />
        <select className={INPUT} value={form.status} onChange={set("status")}>
          <option value="В наличии">В наличии</option>
          <option value="Занят">Занят</option>
        </select>
        <div>
          <input className={INPUT} placeholder="Ссылка на превью-картинку (необязательно)" value={form.image_url} onChange={set("image_url")} />
          <p className="mt-1 text-[10px] text-neutral-600">Если оставить пустым, будет автоматически взят первый кадр из видео</p>
        </div>
        <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#0A0A0A] px-4 py-3 text-sm text-neutral-500 cursor-pointer hover:border-white/40 transition-colors">
          <input type="file" accept="video/mp4" className="hidden" onChange={handleVideoUpload} disabled={uploading} />
          {uploading ? "Видео загружается..." : form.video_url ? "Видео загружено ✓" : "Загрузить видео (.mp4)"}
        </label>
      </div>
      {toast && <div className="mt-3 rounded-xl bg-green-900/30 border border-green-900/40 px-4 py-2.5"><p className="text-xs text-green-400 text-center">{toast}</p></div>}
      <button onClick={handleSubmit} disabled={loading || !form.title.trim()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-40">
        <Plus size={16} />{loading ? "Отправка..." : "Добавить аккаунт в каталог"}
      </button>
    </div>
  );
}

// ─── Screen: Account List ────────────────────────────────────────────────────

function ListScreen({ onEdit, onAdd, onAccountsChanged }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAccounts();
      setAccounts(res.accounts);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, title) => {
    setConfirmDelete({ id, title });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    try {
      await deleteAccount(confirmDelete.id);
      setAccounts((prev) => prev.filter((a) => a.id !== confirmDelete.id));
      if (onAccountsChanged) onAccountsChanged();
    } catch { /* ignore */ }
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Каталог аккаунтов</h3>
        <button onClick={onAdd} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20">
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
                <video src={API_URL + a.video_url + "#t=0.001"} preload="metadata" playsInline muted
                  className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              ) : (
                <img src="/placeholder.svg" alt="" className="h-12 w-12 rounded-lg object-cover bg-neutral-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{a.title}</p>
                <p className="text-[10px] text-neutral-500 truncate">
                  [{a.status.toUpperCase()}] {a.price.toLocaleString("ru-RU")} ₽
                </p>
              </div>
              <button onClick={() => onEdit(a)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white shrink-0">
                <Pencil size={16} />
              </button>
              <button onClick={() => handleDelete(a.id, a.title)} className="p-2 rounded-lg hover:bg-red-900/30 text-neutral-400 hover:text-red-400 shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1A1A] p-6">
            <p className="text-sm font-bold text-white text-center">
              Удалить «{confirmDelete.title}»?
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5">
                Отмена
              </button>
              <button onClick={confirmDeleteAction}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98]">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen: Edit Account ────────────────────────────────────────────────────

function EditScreen({ account, onBack }) {
  const [form, setForm] = useState({
    title: account.title,
    price: String(account.price),
    status: account.status,
    image_url: account.image_url,
    video_url: account.video_url || "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadVideo(file);
      setForm((f) => ({ ...f, video_url: res.video_url }));
      setToast("Видео загружено!");
    } catch {
      setToast("Ошибка загрузки видео");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setToast(null);
    try {
      await updateAccount(account.id, {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        status: form.status,
        image_url: form.image_url.trim() || "/placeholder.svg",
        video_url: form.video_url,
      });
      setToast("Сохранено!");
      setTimeout(() => onBack(), 800);
    } catch {
      setToast("Ошибка сервера");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400"><ArrowLeft size={18} /></button>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Редактирование</h3>
      </div>
      <div className="space-y-3">
        <input className={INPUT} placeholder="Название" value={form.title} onChange={set("title")} />
        <input className={INPUT} type="number" placeholder="Цена (₽)" value={form.price} onChange={set("price")} />
        <select className={INPUT} value={form.status} onChange={set("status")}>
          <option value="В наличии">В наличии</option>
          <option value="Занят">Занят</option>
        </select>
        <div>
          <input className={INPUT} placeholder="Ссылка на превью-картинку (необязательно)" value={form.image_url} onChange={set("image_url")} />
          <p className="mt-1 text-[10px] text-neutral-600">Если оставить пустым, будет автоматически взят первый кадр из видео</p>
        </div>
        <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#0A0A0A] px-4 py-3 text-sm text-neutral-500 cursor-pointer hover:border-white/40 transition-colors">
          <input type="file" accept="video/mp4" className="hidden" onChange={handleVideoUpload} disabled={uploading} />
          {uploading ? "Видео загружается..." : form.video_url ? "Видео загружено ✓" : "Загрузить видео (.mp4)"}
        </label>
      </div>
      {toast && <div className="mt-3 rounded-xl bg-green-900/30 border border-green-900/40 px-4 py-2.5"><p className="text-xs text-green-400 text-center">{toast}</p></div>}
      <div className="mt-4 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5">Назад</button>
        <button onClick={handleSave} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-40">
          <Check size={16} />{loading ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

// ─── Main AdminPanel ─────────────────────────────────────────────────────────

export default function AdminPanel({ onAccountsChanged }) {
  const [view, setView] = useState("list");
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleAccountsChanged = () => {
    if (onAccountsChanged) onAccountsChanged();
  };

  return (
    <div className="mx-4 mt-6 rounded-2xl border border-white/5 bg-[#1A1A1A] p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">Панель управления</h3>
          <p className="text-[10px] text-neutral-500 tracking-wider uppercase">MARX SHOP — Admin</p>
        </div>
      </div>

      {view === "list" && (
        <ListScreen
          onAdd={() => setView("add")}
          onEdit={(account) => { setSelectedAccount(account); setView("edit"); }}
          onAccountsChanged={handleAccountsChanged}
        />
      )}
      {view === "add" && <AddScreen onDone={() => { handleAccountsChanged(); setView("list"); }} />}
      {view === "edit" && selectedAccount && (
        <EditScreen account={selectedAccount} onBack={() => { handleAccountsChanged(); setView("list"); }} />
      )}
    </div>
  );
}
