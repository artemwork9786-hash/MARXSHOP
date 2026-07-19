import { useState, useEffect } from "react";
import { Shield, Plus, Pencil, Trash2, ArrowLeft, Check, X, Store, Clock } from "lucide-react";
import { getAccounts, addAccount, updateAccount, deleteAccount, uploadVideo } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const INPUT =
  "w-full rounded-xl bg-[#0A0A0A] border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-white/30 transition-colors";

// ─── Dynamic List Component ─────────────────────────────────────────────────

function DynamicList({ items, onChange, renderItem, addLabel }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">{renderItem(item, i)}</div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 p-2 rounded-lg hover:bg-red-900/30 text-neutral-500 hover:text-red-400">
            <X size={14} />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, null])}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs text-neutral-500 hover:border-white/30 hover:text-neutral-400 transition-colors w-full justify-center">
        <Plus size={14} /> {addLabel}
      </button>
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
        <DynamicList items={rentTerms} addLabel="Добавить тариф"
          onChange={(v) => setForm((f) => ({ ...f, rentTerms: v }))}
          renderItem={(item, i) => (
            <div className="flex gap-2">
              <input className={INPUT} placeholder="3 часа" value={item?.label || ""}
                onChange={(e) => { const v = [...rentTerms]; v[i] = { ...v[i], label: e.target.value }; setForm((f) => ({ ...f, rentTerms: v })); }} />
              <input className={INPUT + " w-28"} type="number" placeholder="₽" value={item?.price || ""}
                onChange={(e) => { const v = [...rentTerms]; v[i] = { ...v[i], price: Number(e.target.value) }; setForm((f) => ({ ...f, rentTerms: v })); }} />
            </div>
          )} />
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
    status: account?.status || "В наличии",
    image_url: account?.image_url || "",
    video_url: account?.video_url || "",
    category: category,
    tags: account?.tags || [],
    rentTerms: account?.rentTerms || [],
    description: account?.description || { title: "", content: "" },
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRent = form.category === "rent";

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
      const payload = {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        status: form.status,
        image_url: form.image_url.trim() || "/placeholder.svg",
        video_url: form.video_url,
        category: form.category,
      };
      if (isRent) {
        payload.tags = (form.tags || []).filter(Boolean);
        payload.rentTerms = (form.rentTerms || []).filter((t) => t?.label);
        payload.description = form.description?.title || form.description?.content ? form.description : null;
      }
      if (isEdit) {
        await updateAccount(account.id, payload);
        setToast("Сохранено!");
      } else {
        await addAccount(payload);
        setToast("Аккаунт добавлен!");
      }
      setTimeout(() => onDone(), 800);
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
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{isEdit ? "Редактирование" : "Добавить аккаунт"}</h3>
      </div>
      <div className="space-y-3">
        <input className={INPUT} placeholder="Название (MARX VIP #1)" value={form.title} onChange={set("title")} />
        <input className={INPUT} type="number" placeholder={isRent ? "Цена (₽, необязательно)" : "Цена (₽)"} value={form.price} onChange={set("price")} />
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

        {isRent && <RentFields form={form} setForm={setForm} />}
      </div>
      {toast && <div className="mt-3 rounded-xl bg-green-900/30 border border-green-900/40 px-4 py-2.5"><p className="text-xs text-green-400 text-center">{toast}</p></div>}
      <div className="mt-4 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5">Назад</button>
        <button onClick={handleSubmit} disabled={loading || !form.title.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black uppercase tracking-wider active:scale-[0.98] disabled:opacity-40">
          <Check size={16} />{loading ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Account List ────────────────────────────────────────────────────

function ListScreen({ category, onEdit, onAdd, onAccountsChanged }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
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
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{label} — каталог</h3>
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
                <video src={(a.video_url.startsWith("http") ? a.video_url : API_URL + a.video_url) + "#t=0.001"} preload="metadata" playsInline muted
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
              <button onClick={() => setConfirmDelete({ id: a.id, title: a.title })} className="p-2 rounded-lg hover:bg-red-900/30 text-neutral-400 hover:text-red-400 shrink-0">
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
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-neutral-400 uppercase tracking-wider hover:bg-white/5">Отмена</button>
              <button onClick={confirmDeleteAction}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white uppercase tracking-wider active:scale-[0.98]">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminPanel ─────────────────────────────────────────────────────────

export default function AdminPanel({ onAccountsChanged }) {
  const [view, setView] = useState("list");
  const [activeTab, setActiveTab] = useState("rent");
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

      {/* Tabs */}
      {view === "list" && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab("rent")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "rent" ? "bg-white text-black" : "bg-white/5 text-neutral-500 hover:bg-white/10"}`}>
            <Clock size={14} /> Аренда
          </button>
          <button onClick={() => setActiveTab("shop")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "shop" ? "bg-white text-black" : "bg-white/5 text-neutral-500 hover:bg-white/10"}`}>
            <Store size={14} /> Магазин
          </button>
        </div>
      )}

      {view === "list" && (
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
    </div>
  );
}
