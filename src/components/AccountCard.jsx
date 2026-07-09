import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Maximize, Volume2, VolumeX } from "lucide-react";
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

// ─── Video Player with Canvas Blur ───────────────────────────────────────────

function VideoPlayer({ src, poster, title, status }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const volumeRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const hideTimer = useRef(null);
  const volumeTimer = useRef(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleInput = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const val = parseFloat(e.target.value);
    const time = (val / 1000) * v.duration;
    setCurrentTime(time);
  }, []);

  const handlePointerDown = useCallback(() => setDragging(true), []);

  const handlePointerUp = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const val = parseFloat(e.target.value);
    v.currentTime = (val / 1000) * v.duration;
    setCurrentTime(v.currentTime);
    setDragging(false);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const setVolumeFromY = useCallback((clientY) => {
    const el = volumeRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const rect = el.getBoundingClientRect();
    const val = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) { v.muted = false; setMuted(false); }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement)
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }, []);

  // Video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.5;

    const handlers = {
      timeupdate: () => { if (!dragging) setCurrentTime(v.currentTime); },
      loadedmetadata: () => setDuration(v.duration),
      ended: () => { setPlaying(false); setShowControls(true); setIsLoading(false); },
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      waiting: () => setIsLoading(true),
      canplay: () => setIsLoading(false),
      playing: () => setIsLoading(false),
      seeking: () => setIsLoading(true),
      seeked: () => setIsLoading(false),
    };

    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn));
  }, [src, dragging]);

  // Auto-hide controls
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

  // Canvas blur at 24fps
  useEffect(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    const ctx = canvas.getContext("2d");
    let animId;
    let lastFrame = 0;
    const interval = 1000 / 24;

    const draw = (ts) => {
      if (ts - lastFrame >= interval && v.readyState >= 2) {
        canvas.width = 320;
        canvas.height = 180;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        lastFrame = ts;
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [src]);

  const inputValue = (currentTime / (duration || 1)) * 1000;
  const isAvailable = status === "В наличии";

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden bg-[#111] cursor-pointer"
      onClick={(e) => {
        if (e.target.closest("[data-interactive]")) return;
        togglePlay();
        resetHideTimer();
      }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Layer 0: Video fills entire card */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Layer 1: Interface overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* Play button (center) */}
        {!playing && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-xl shadow-black/40">
              <Play size={24} className="text-white ml-1" fill="white" />
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-xl shadow-black/40">
              <div className="h-7 w-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"
          }`}>{status}</div>
        </div>

        {/* Title floating above glass panel */}
        {title && (
          <div className="absolute bottom-[120px] left-6">
            <span
              className="text-2xl font-black text-white uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,1)]"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              {title}
            </span>
          </div>
        )}

        {/* Bottom glass panel */}
        <div
          data-interactive
          className="absolute bottom-0 left-0 w-full h-[100px] flex justify-between items-center px-6 pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Canvas blur background */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ filter: "blur(24px) scale(1.3)", transform: "translateZ(0)" }}
          />

          {/* Dark tint */}
          <div className="absolute inset-0 bg-black/25 pointer-events-none" />

          {/* Thin progress bar at top of panel */}
          <div className="absolute top-0 left-0 right-0 h-[3px] cursor-pointer group/track pointer-events-auto"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              if (videoRef.current?.duration) videoRef.current.currentTime = pct * videoRef.current.duration;
            }}
          >
            <div className="absolute inset-0 bg-white/15" />
            <div className="absolute top-0 left-0 h-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] opacity-0 group-hover/track:opacity-100 transition-opacity pointer-events-none" style={{ left: `calc(${progress}% - 5px)` }} />
          </div>

          {/* Content: price + button + controls */}
          <div className="relative z-10 flex items-center justify-between w-full">
            {/* Left: play + time */}
            <div className="flex items-center gap-3">
              <button data-interactive onClick={togglePlay} className="text-white hover:text-white/80 transition-colors pointer-events-auto">
                {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
              </button>
              <span className="text-xs font-medium text-white/70 tabular-nums select-none pointer-events-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: volume + fullscreen */}
            <div className="flex items-center gap-3">
              <div
                className="relative shrink-0 pointer-events-auto"
                onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }}
                onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }}
              >
                <button data-interactive onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                  {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                {showVolume && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center p-2.5 rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                    onMouseEnter={() => clearTimeout(volumeTimer.current)}
                    onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }}
                  >
                    <div
                      ref={volumeRef}
                      className="relative h-24 w-8 cursor-pointer touch-none select-none"
                      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setVolumeDragging(true); volumeRef.current?.setPointerCapture(e.pointerId); setVolumeFromY(e.clientY); }}
                      onPointerMove={(e) => { if (!volumeDragging) return; e.preventDefault(); setVolumeFromY(e.clientY); }}
                      onPointerUp={(e) => { setVolumeDragging(false); volumeRef.current?.releasePointerCapture(e.pointerId); }}
                    >
                      <div className="absolute bottom-1 top-1 left-1/2 -translate-x-1/2 w-1 rounded-full bg-white/15 pointer-events-none" />
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 rounded-full bg-white pointer-events-none" style={{ height: `${(muted ? 0 : volume) * 100}%` }} />
                      <div className="absolute left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none" style={{ bottom: `calc(${(muted ? 0 : volume) * 92}% + 1px - 6px)` }} />
                    </div>
                  </div>
                )}
              </div>
              <button data-interactive onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors pointer-events-auto">
                <Maximize size={16} />
              </button>
            </div>
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
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1A1A1A] shadow-2xl shadow-black/80">
      {hasVideo ? (
        <VideoPlayer src={videoSrc} poster={account.image_url || undefined} title={account.title} status={account.status} />
      ) : (
        <div className="relative w-full aspect-video bg-[#111]">
          <img src={account.image_url || "/placeholder.svg"} alt={account.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute top-3 left-3">
              <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                isAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"
              }`}>{account.status}</div>
            </div>
            <div className="absolute bottom-[120px] left-6">
              <span className="text-2xl font-black text-white uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,1)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                {account.title}
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[100px] bg-[#1A1A1A] flex items-center px-6 z-20">
            <span className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              {formattedPrice}<span className="ml-1 text-sm text-neutral-500">{curr.symbol}</span>
            </span>
            <div className="flex-1" />
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
      )}
    </div>
  );
}
