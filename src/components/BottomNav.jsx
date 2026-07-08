import { Store, User, Info } from "lucide-react";

const NAV_ITEMS = [
  { id: "shop", label: "Магазин", icon: Store },
  { id: "profile", label: "Профиль", icon: User },
  { id: "info", label: "Инфо", icon: Info },
];

export default function BottomNav({ active, setActive }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-neutral-900/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex flex-col items-center gap-0.5 transition-all ${
                isActive ? "text-white" : "text-neutral-600"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium tracking-wider uppercase">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
