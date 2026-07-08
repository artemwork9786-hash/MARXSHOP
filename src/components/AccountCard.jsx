import { useState, useRef } from "react";
import { Play } from "lucide-react";
import { CURRENCIES } from "../data/accounts";

export default function AccountCard({ account, currency, onRent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  const curr = CURRENCIES.find((c) => c.code === currency);
  const price = account.prices[currency.toLowerCase()];
  const isAvailable = account.status === "available";
  const formattedPrice = price.toLocaleString("ru-RU");

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1A1A1A]">
      {/* Media Zone */}
      <div className="relative h-48 w-full">
        {isPlaying ? (
          <video
            ref={videoRef}
            src={account.video}
            autoPlay
            controls
            playsInline
            className="h-full w-full rounded-t-2xl object-cover"
          />
        ) : (
          <button
            onClick={handlePlay}
            className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-t-2xl bg-[#1A1A1A] transition-colors hover:bg-[#222]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Play size={24} className="ml-0.5 text-white" fill="white" />
            </div>
            <span className="text-xs text-neutral-500">Смотреть видеообзор</span>
          </button>
        )}

        {/* Status Badge */}
        <span
          className={`absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isAvailable
              ? "bg-white text-black"
              : "bg-neutral-700 text-neutral-400"
          }`}
        >
          {isAvailable ? "В наличии" : "Занят"}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-white tracking-wide">
          {account.title}
        </h3>

        {/* Skins */}
        <div className="mt-2 flex flex-wrap gap-2">
          {account.skins.map((skin) => (
            <span
              key={skin}
              className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300"
            >
              {skin}
            </span>
          ))}
        </div>

        {/* Price & Button */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white">
            {formattedPrice}
            <span className="ml-1 text-sm text-neutral-500">{curr.symbol}</span>
          </span>
          <button
            onClick={isAvailable ? onRent : undefined}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all active:scale-95 ${
              isAvailable
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-neutral-800 text-neutral-600 active:scale-100 cursor-not-allowed"
            }`}
            disabled={!isAvailable}
          >
            Арендовать
          </button>
        </div>
      </div>
    </div>
  );
}
