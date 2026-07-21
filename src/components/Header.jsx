import { User } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-[200] border-b border-white/5 bg-neutral-900/70 px-4 pt-4 pb-3 backdrop-blur-md">
      <div className="flex items-center justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-widest text-white uppercase truncate">
            MARX SHOP
          </h1>
          <p className="text-[11px] tracking-[0.15em] text-neutral-500 uppercase truncate">
            Аренда аккаунтов — мгновенная выдача
          </p>
        </div>
        <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-800/60 text-neutral-400 transition-colors hover:bg-neutral-700/60 hover:text-white cursor-pointer">
          <User size={18} />
        </button>
      </div>
    </header>
  );
}
