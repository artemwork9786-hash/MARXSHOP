import { useState } from "react";
import { Play } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AccountCard({ account, onRent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isAvailable = account.status === "В наличии";
  const formattedPrice = account.price.toLocaleString("ru-RU");
  const hasVideo = !!account.video_url;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1A1A1A]">
      {/* Media Zone */}
      <div className="relative h-48 w-full">
        {isPlaying && hasVideo ? (
          <video
            src={API_URL + account.video_url}
            autoPlay
            controls
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

        {/* Video Button */}
        {hasVideo && !isPlaying && (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[10px] font-bold text-white uppercase tracking-wider hover:bg-black/80 transition-colors"
          >
            <Play size={12} fill="white" /> Видеообзор
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
          {account.status}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-white tracking-wide">
          {account.title}
        </h3>

        {account.description && (
          <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{account.description}</p>
        )}

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {account.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Price & Button */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white">
            {formattedPrice}
            <span className="ml-1 text-sm text-neutral-500">₽</span>
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
