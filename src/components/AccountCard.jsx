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

// ─── Glassmorphism Video Player ───────────────────────────────────────────────

function GlassPlayer({ src, poster, title, status }) {
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

  const handlePointerDown = useCallback(() => {
    setDragging(true);
    setIsLoading(true);
  }, []);

  const handlePointerUp = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const val = parseFloat(e.target.value);
    const time = (val / 1000) * v.duration;
    v.currentTime = time;
    setCurrentTime(time);
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
    const pct = 1 - (clientY - rect.top) / rect.height;
    const val = Math.max(0, Math.min(1, pct));
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) {
      v.muted = false;
      setMuted(false);
    }
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value) / 100;
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) {
      v.muted = false;
      setMuted(false);
    }
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

  // Video event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.5;

    const onTimeUpdate = () => { if (!dragging) setCurrentTime(v.currentTime); };
    const onLoadedMetadata = () => setDuration(v.duration);
    const onEnded = () => { setPlaying(false); setShowControls(true); setIsLoading(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlayingEv = () => setIsLoading(false);
    const onSeekingEv = () => setIsLoading(true);
    const onSeekedEv = () => setIsLoading(false);

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("playing", onPlayingEv);
    v.addEventListener("seeking", onSeekingEv);
    v.addEventListener("seeked", onSeekedEv);

    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("playing", onPlayingEv);
      v.removeEventListener("seeking", onSeekingEv);
      v.removeEventListener("seeked", onSeekedEv);
    };
  }, [src, dragging]);

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

  // Canvas blur capture at ~24fps
  useEffect(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    const ctx = canvas.getContext("2d");
    let animId;
    let lastFrame = 0;
    const interval = 1000 / 24;

    const draw = (timestamp) => {
      if (timestamp - lastFrame >= interval) {
        if (v.readyState >= 2) {
          canvas.width = 320;
          canvas.height = 180;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        }
        lastFrame = timestamp;
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
        if (e.target.closest("[data-glass-controls]")) return;
        togglePlay();
        resetHideTimer();
      }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Main video */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Play button */}
      {!playing && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-xl shadow-black/40">
            <Play size={24} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-xl shadow-black/40">
            <div className="h-7 w-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-3 left-3 z-30">
        <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          isAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"
        }`}>
          {status}
        </div>
      </div>

      {/* Title with blur background */}
      {title && (
        <div className="absolute bottom-24 left-3 z-30">
          <div className="rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 px-2.5 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              {title}
            </span>
          </div>
        </div>
      )}

      {/* Ultra-thin progress bar above glass panel */}
      <div
        data-glass-controls
        className={`absolute bottom-[120px] left-0 right-0 z-30 px-2 transition-all duration-300 ease-out ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-[3px] w-full cursor-pointer rounded-full bg-white/15 group/track" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const v = videoRef.current;
          if (v && v.duration) v.currentTime = pct * v.duration;
        }}>
          <div className="absolute top-0 left-0 h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none opacity-0 group-hover/track:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 5px)` }} />
        </div>
      </div>

      {/* Glass panel: canvas blur + dark tint + controls */}
      <div
        data-glass-controls
        className={`absolute bottom-0 left-0 right-0 h-[120px] overflow-hidden z-20 transition-all duration-300 ease-out ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Canvas blur layer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-125 pointer-events-none"
          style={{ filter: "blur(20px)" }}
        />
        {/* Dark tint */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />

        {/* Controls content */}
        <div className="relative z-10 h-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
              {playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
            </button>
            <span className="text-xs font-medium text-white/70 tabular-nums select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="relative shrink-0"
              onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }}
              onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }}
            >
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
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
            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
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
  const priceCanvasRef = useRef(null);
  const priceVideoRef = useRef(null);
  const isAvailable = account.status === "В наличии";
  const curr = CURRENCIES.find((c) => c.code === currency);
  const converted = convertPrice(account.price, currency, rates);
  const formattedPrice = converted.toLocaleString("ru-RU");
  const hasVideo = !!account.video_url;
  const videoSrc = hasVideo ? API_URL + account.video_url : null;

  // Canvas capture for price bar blur
  useEffect(() => {
    const v = priceVideoRef.current;
    const canvas = priceCanvasRef.current;
    if (!v || !canvas || !hasVideo) return;

    const ctx = canvas.getContext("2d");
    let animId;
    let lastFrame = 0;
    const interval = 1000 / 24;

    const draw = (timestamp) => {
      if (timestamp - lastFrame >= interval) {
        if (v.readyState >= 2) {
          canvas.width = 320;
          canvas.height = 80;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        }
        lastFrame = timestamp;
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [hasVideo]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1A1A1A] shadow-2xl shadow-black/80">
      {/* Video Player */}
      {hasVideo ? (
        <GlassPlayer src={videoSrc} poster={account.image_url || undefined} title={account.title} status={account.status} />
      ) : (
        <div className="relative w-full aspect-video bg-[#111]">
          <img src={account.image_url || "/placeholder.svg"} alt={account.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-3 left-3 z-30">
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"
            }`}>{account.status}</div>
          </div>
          <div className="absolute bottom-24 left-3 z-30">
            <div className="rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 px-2.5 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                {account.title}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Price bar with canvas blur background */}
      <div className="relative h-[120px] overflow-hidden">
        {hasVideo && (
          <>
            <video
              ref={priceVideoRef}
              src={`${videoSrc}#t=0.001`}
              muted
              playsInline
              preload="metadata"
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />
            <canvas
              ref={priceCanvasRef}
              className="absolute inset-0 w-full h-full object-cover scale-125 pointer-events-none"
              style={{ filter: "blur(20px)" }}
            />
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          </>
        )}
        <div className="absolute inset-0 bg-[#1A1A1A]" style={{ display: hasVideo ? "none" : "block" }} />
        <div className="relative z-10 h-full flex items-center justify-between px-4">
          <span className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
