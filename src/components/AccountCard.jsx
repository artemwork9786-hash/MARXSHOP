import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Maximize } from "lucide-react";
import { CURRENCIES } from "../data/accounts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function convertPrice(priceRub, currency, rates) {
  if (currency === "RUB") return priceRub;
  if (currency === "USD") return Math.round(priceRub / rates.usd_to_rub);
  if (currency === "UAH") return Math.round((priceRub / rates.usd_to_rub) * rates.usd_to_uah);
  return priceRub;
}

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Glassmorphism Video Player ───────────────────────────────────────────────

function GlassPlayer({ src, poster }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const seek = useCallback((e) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onEnd = () => { setPlaying(false); setShowControls(true); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("ended", onEnd);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-48 w-full rounded-t-2xl overflow-hidden bg-black cursor-pointer"
      onClick={(e) => {
        if (e.target.closest("[data-glass-controls]")) return;
        togglePlay();
        resetHideTimer();
      }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Center play button (shown when paused) */}
      {!playing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-xl shadow-black/40">
            <Play size={24} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-3 left-3 z-30">
        <div className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-black uppercase tracking-wider">
          Видео
        </div>
      </div>

      {/* Glassmorphism Control Bar */}
      <div
        data-glass-controls
        className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-out ${
          showControls
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-2 mb-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative mx-4 mt-3 h-1 w-[calc(100%-2rem)] cursor-pointer rounded-full bg-white/20 group/track"
            onClick={seek}
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] opacity-0 group-hover/track:opacity-100 transition-opacity duration-200"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={togglePlay}
              className="shrink-0 text-white hover:text-white/80 transition-colors"
            >
              {playing ? (
                <Pause size={16} fill="white" />
              ) : (
                <Play size={16} fill="white" className="ml-0.5" />
              )}
            </button>
            <span className="text-[11px] font-medium text-white/80 tabular-nums shrink-0 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="flex-1" />
            <button
              onClick={toggleFullscreen}
              className="shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Account Card ────────────────────────────────────────────────────────────

export default function AccountCard({ account, currency, rates, onRent }) {
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
        {hasVideo ? (
          <GlassPlayer src={videoSrc} poster={account.image_url || undefined} />
        ) : (
          <img
            src={account.image_url || "/placeholder.svg"}
            alt={account.title}
            className="h-full w-full rounded-t-2xl object-cover"
          />
        )}

        {/* Status badge */}
        <span
          className={`absolute top-3 left-3 z-30 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
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
