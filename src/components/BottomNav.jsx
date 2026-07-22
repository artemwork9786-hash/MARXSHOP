import { Store, Clock, User, Info } from "lucide-react";

const NAV_ITEMS = [
  { id: "shop", label: "Шоп", icon: Store },
  { id: "rent", label: "Аренда", icon: Clock },
  { id: "profile", label: "Профиль", icon: User },
  { id: "info", label: "Инфо", icon: Info },
];

export default function BottomNav({ active, setActive }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#111]/80 backdrop-blur-md" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="mx-auto flex max-w-lg items-center justify-around pt-2 pb-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex flex-col items-center gap-0.5 min-h-[44px] min-w-[44px] justify-center transition-all cursor-pointer ${
                isActive ? "text-white" : "text-neutral-600"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium tracking-wider">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
