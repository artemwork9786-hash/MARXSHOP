import { useState } from "react";
import { Play } from "lucide-react";
import { CURRENCIES } from "../data/accounts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function convertPrice(priceRub, currency, rates) {
  if (currency === "RUB") return priceRub;
  if (currency === "USD") return Math.round(priceRub / rates.usd_to_rub);
  if (currency === "UAH") return Math.round((priceRub / rates.usd_to_rub) * rates.usd_to_uah);
  return priceRub;
}

export default function AccountCard({ account, currency, rates, onRent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isAvailable = account.status === "В наличии";
  const curr = CURRENCIES.find((c) => c.code === currency);
  const converted = convertPrice(account.price, currency, rates);
  const formattedPrice = converted.toLocaleString("ru-RU");
  const hasVideo = !!account.video_url;
  const videoSrc = hasVideo ? API_URL + account.video_url : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1A1A1A]">
      {/* Media Zone */}
      <div className="relative h-48 w-full">
        {isPlaying && videoSrc ? (
          <video
            src={videoSrc}
            autoPlay
            controls
            playsInline
            className="h-full w-full rounded-t-2xl object-cover"
          />
        ) : videoSrc ? (
          <video
            src={videoSrc + "#t=0.001"}
            poster={account.image_url || undefined}
            preload="metadata"
            playsInline
            className="h-full w-full rounded-t-2xl object-cover"
          />
        ) : (
          <img
            src={account.image_url || "/placeholder.svg"}
            alt={account.title}
            className="h-full w-full rounded-t-2xl object-cover"
          />
        )}

        {hasVideo && !isPlaying && (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[10px] font-bold text-white uppercase tracking-wider hover:bg-black/80 transition-colors"
          >
            <Play size={12} fill="white" /> Видеообзор
          </button>
        )}

        <span
          className={`absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"
          }`}
        >
          {account.status}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-bold text-white tracking-wide">{account.title}</h3>
        {account.description && (
          <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{account.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {account.tags.map((tag) => (
            <span key={tag} className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">{tag}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white">
            {formattedPrice}<span className="ml-1 text-sm text-neutral-500">{curr.symbol}</span>
          </span>
          <button
            onClick={isAvailable ? onRent : undefined}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all active:scale-95 ${
              isAvailable ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-800 text-neutral-600 active:scale-100 cursor-not-allowed"
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
