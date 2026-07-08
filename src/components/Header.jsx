import { User } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-900/70 px-4 pt-4 pb-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">
            MARX SHOP
          </h1>
          <p className="text-[11px] tracking-[0.2em] text-neutral-500 uppercase">
            Аренда аккаунтов — мгновенная выдача
          </p>
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800/60 text-neutral-400 transition-colors hover:bg-neutral-700/60 hover:text-white">
          <User size={18} />
        </button>
      </div>
    </header>
  );
}
