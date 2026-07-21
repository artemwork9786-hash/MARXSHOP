import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, Maximize, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { CURRENCIES } from "../data/accounts";
import { getTermLabel } from "../utils/duration";
import { convertPrice } from "../utils/currency";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Extract first frame from video as poster ─────────────────────────────────

export function extractPoster(videoSrc) {
  return new Promise((resolve) => {
    const isCrossOrigin = videoSrc.startsWith("http") && !videoSrc.includes(window.location.hostname);
    const src = isCrossOrigin ? `${API_URL}/api/proxy-video?url=${encodeURIComponent(videoSrc)}` : videoSrc;

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = src;

    const timeout = setTimeout(() => { video.src = ""; resolve(null); }, 15000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, video.duration * 0.01);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        video.src = "";
        resolve(dataUrl);
      } catch {
        video.src = "";
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      video.src = "";
      resolve(null);
    };
  });
}

function formatBusyTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const mskOffset = 3 * 60;
  const localOffset = date.getTimezoneOffset();
  const mskTime = new Date(date.getTime() + (localOffset + mskOffset) * 60 * 1000);
  const hh = String(mskTime.getUTCHours()).padStart(2, "0");
  const mm = String(mskTime.getUTCMinutes()).padStart(2, "0");
  const dd = String(mskTime.getUTCDate()).padStart(2, "0");
  const MM = String(mskTime.getUTCMonth() + 1).padStart(2, "0");
  const now = new Date();
  const nowMsk = new Date(now.getTime() + (now.getTimezoneOffset() + mskOffset) * 60 * 1000);
  const isToday =
    mskTime.getUTCFullYear() === nowMsk.getUTCFullYear() &&
    mskTime.getUTCMonth() === nowMsk.getUTCMonth() &&
    mskTime.getUTCDate() === nowMsk.getUTCDate();
  const tomorrowMsk = new Date(nowMsk);
  tomorrowMsk.setUTCDate(tomorrowMsk.getUTCDate() + 1);
  const isTomorrow =
    mskTime.getUTCFullYear() === tomorrowMsk.getUTCFullYear() &&
    mskTime.getUTCMonth() === tomorrowMsk.getUTCMonth() &&
    mskTime.getUTCDate() === tomorrowMsk.getUTCDate();
  if (isToday) return `до ${hh}:${mm}`;
  return `до ${hh}:${mm} (${dd}.${MM})`;
}

// ─── Glassmorphism Video Player ───────────────────────────────────────────────

function GlassPlayer({ src, poster, title, statusLabel, statusIsAvailable, videoHidden, onFullscreenChange, initialDuration }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const volumeRef = useRef(null);
  const volumeBtnRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const wasPlayingRef = useRef(false);
  const [hasData, setHasData] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const showVolumeRef = useRef(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const hideTimer = useRef(null);
  const volumeTimer = useRef(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) {
      setStarted(true);
      return;
    }
    if (v.paused) {
      v.muted = false;
      setMuted(false);
      v.play().catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const handleInput = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const time = (parseFloat(e.target.value) / 1000) * v.duration;
    setCurrentTime(time);
  }, []);

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
    setDragging(true);
    setIsLoading(true);
  }, []);

  const handlePointerUp = useCallback((e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const time = (parseFloat(e.target.value) / 1000) * v.duration;
    v.currentTime = time;
    setCurrentTime(time);
    draggingRef.current = false;
    setDragging(false);
    setIsLoading(false);
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dimOpacity, setDimOpacity] = useState(0);
  const [dimBlur, setDimBlur] = useState(0);

  const toggleFullscreen = useCallback(() => {
    if (isTransitioning) return;
    if (!started) setStarted(true);
    setIsTransitioning(true);
    setDimOpacity(1);
    setDimBlur(40);
    setTimeout(() => {
      setIsFullscreen(prev => !prev);
      setDimOpacity(0);
      setDimBlur(0);
      setTimeout(() => setIsTransitioning(false), 500);
    }, 500);
  }, [isTransitioning, started]);

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0.5;

    const onTimeUpdate = () => { if (!draggingRef.current) setCurrentTime(v.currentTime); };
    const onLoadedMetadata = () => setDuration(v.duration);
    const onLoadedData = () => setHasData(true);
    const onEnded = () => { setPlaying(false); setShowControls(true); setIsLoading(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => { if (!draggingRef.current) setIsLoading(false); };
    const onPlayingEv = () => { setIsLoading(false); };
    const onSeekingEv = () => setIsLoading(true);
    const onSeekedEv = () => setIsLoading(false);

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("loadedmetadata", onLoadedMetadata);
    v.addEventListener("loadeddata", onLoadedData);
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
      v.removeEventListener("loadeddata", onLoadedData);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("playing", onPlayingEv);
      v.removeEventListener("seeking", onSeekingEv);
      v.removeEventListener("seeked", onSeekedEv);
    };
  }, [src, started]);

  useEffect(() => {
    setHasData(false);
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (videoHidden) {
      wasPlayingRef.current = !v.paused;
      v.pause();
    } else if (wasPlayingRef.current) {
      v.play().catch(() => {});
    }
  }, [videoHidden]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !started) return;
    v.muted = false;
    v.play().catch(() => {});
  }, [started]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        if (showVolumeRef.current) return;
        setShowControls(false);
        setShowVolume(false);
      }
    }, 2000);
  }, []);

  const startVolumeHideTimer = useCallback(() => {
    clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => {
      setShowVolume(false);
    }, 2500);
  }, []);

  const resetVolumeTimer = useCallback(() => {
    if (showVolumeRef.current) startVolumeHideTimer();
  }, [startVolumeHideTimer]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      clearTimeout(hideTimer.current);
      clearTimeout(volumeTimer.current);
    };
  }, []);

  useEffect(() => {
    showVolumeRef.current = showVolume;
    if (!showVolume && videoRef.current && !videoRef.current.paused) {
      resetHideTimer();
    }
  }, [showVolume]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setShowControls(true);
    resetHideTimer();
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handlePopState = () => setIsFullscreen(false);
    window.history.pushState({ fullscreen: true }, "");
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.fullscreen) window.history.back();
    };
  }, [isFullscreen]);

  const inputValue = (currentTime / (duration || 1)) * 1000;

  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-[#111]"
        style={isFullscreen ? undefined : { clipPath: "inset(0 round 1rem 1rem 0 0)" }}
        onClick={(e) => {
          if (isFullscreen || e.target.closest("[data-glass-controls]")) return;
          togglePlay();
          resetHideTimer();
        }}
        onMouseMove={!isFullscreen ? resetHideTimer : undefined}
        onTouchStart={!isFullscreen ? resetHideTimer : undefined}
      >
        {started && (
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
            onError={(e) => console.error("[GlassPlayer] Video error:", src, e.target.error)}
            className={
              isFullscreen
                ? "fixed inset-0 w-full h-full object-contain bg-black"
                : `absolute inset-0 w-full h-full object-cover ${videoHidden ? "opacity-0" : "opacity-100"}`
            }
            style={isFullscreen ? { zIndex: 9999 } : undefined}
          />
        )}
        {poster && !hasData && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 2 }}
          />
        )}

        {!isFullscreen && (
          <>
            {!playing && !isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-xl shadow-black/40" style={{ width: "14%", minWidth: "44px", maxWidth: "56px", aspectRatio: "1" }}>
                  <Play size={24} className="text-white ml-1" fill="white" />
                </div>
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-xl shadow-black/40" style={{ width: "14%", minWidth: "44px", maxWidth: "56px", aspectRatio: "1" }}>
                  <div className="h-7 w-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              </div>
            )}
            <div className="absolute top-3 left-3 z-30">
              <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${statusIsAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"}`}>{statusLabel}</div>
            </div>
            {title && (
              <div className="absolute left-1.5 bottom-3 z-30 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ transform: showControls ? "translateY(-40px)" : "translateY(0)" }}>
                <div className="rounded-lg bg-black/50 backdrop-blur-md border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]" style={{ padding: "3px 8px", lineHeight: "20px" }}>
                  <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{title}</span>
                </div>
              </div>
            )}
            <div data-glass-controls className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out`} style={{ transform: showControls ? "translateY(0)" : "translateY(16px)", pointerEvents: showControls ? "auto" : "none" }} onClick={(e) => e.stopPropagation()}>
              <div className={`mx-1.5 mb-1.5 rounded-xl border border-white/[0.08] bg-black/63 backdrop-blur-md transition-opacity duration-300 relative z-[5] ${showControls ? "opacity-100" : "opacity-0"}`}>
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <button onClick={togglePlay} className="shrink-0 text-white hover:text-white/80 transition-colors cursor-pointer">
                    {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                  </button>
                  <span className="text-[11px] font-medium text-white/70 tabular-nums shrink-0 select-none">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  <div className="flex-1 mx-2 relative flex items-center h-7">
                    <div className="absolute left-0 right-0 h-1 rounded-full pointer-events-none" style={{ background: `linear-gradient(to right, #ffffff ${progress}%, rgba(255,255,255,0.15) ${progress}%)` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none" style={{ left: `calc(${progress}% - 6px)` }} />
                    <input ref={inputRef} type="range" min="0" max="1000" step="1" value={Math.round(inputValue)} onInput={handleInput} onMouseDown={handlePointerDown} onMouseUp={handlePointerUp} onTouchStart={handlePointerDown} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer opacity-0 z-10 m-0 p-0" style={{ WebkitAppearance: "none", MozAppearance: "none" }} />
                  </div>
                  <button ref={volumeBtnRef} onClick={() => { if (showVolume) { toggleMute(); } else { setShowVolume(true); startVolumeHideTimer(); } resetHideTimer(); }} onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }} onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }} className="shrink-0 text-white/70 hover:text-white transition-colors flex items-center justify-center relative z-[60] cursor-pointer">
                    {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <button onClick={toggleFullscreen} className="shrink-0 text-white/70 hover:text-white transition-colors relative z-[60] cursor-pointer">
                    <Maximize size={16} />
                  </button>
                </div>
              </div>
              <div
                className="absolute overflow-hidden rounded-lg bg-black/50 backdrop-blur-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ bottom: showVolume ? "calc(1.5rem + 24px)" : "1.5rem", height: showVolume ? "80px" : "calc(100% - 3rem)", transition: "height 0.3s cubic-bezier(0.4,0,0.2,1), bottom 0.3s cubic-bezier(0.4,0,0.2,1)", pointerEvents: showVolume ? "auto" : "none", width: "36px", right: "26px", zIndex: 1 }}
                onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }}
                onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }}
              >
                <div ref={volumeRef} className="absolute bottom-2 left-1/2 -translate-x-1/2 h-[64px] w-5 cursor-pointer touch-none select-none" style={{ opacity: showVolume ? 1 : 0, transition: "opacity 0.3s" }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setVolumeDragging(true); resetHideTimer(); startVolumeHideTimer(); volumeRef.current?.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!volumeDragging) return; e.preventDefault(); resetHideTimer(); startVolumeHideTimer(); setVolumeFromY(e.clientY); }} onPointerUp={(e) => { setVolumeDragging(false); volumeRef.current?.releasePointerCapture(e.pointerId); }}>
                  <div className="absolute bottom-[3px] top-[3px] left-1/2 -translate-x-1/2 w-[2px] rounded-full bg-white/15 pointer-events-none" />
                  <div className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[2px] rounded-full bg-white pointer-events-none" style={{ height: `calc(${(muted ? 0 : volume) * 58}px)` }} />
                  <div className="absolute left-1/2 -translate-x-1/2 h-[7px] w-[7px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none" style={{ bottom: `calc(${(muted ? 0 : volume) * 58}px)` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {isTransitioning && createPortal(
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 10001,
            opacity: dimOpacity,
            transition: "opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 500ms cubic-bezier(0.4, 0, 0.2, 1), -webkit-backdrop-filter 500ms cubic-bezier(0.4, 0, 0.2, 1)",
            backdropFilter: `blur(${dimBlur}px) saturate(160%)`,
            WebkitBackdropFilter: `blur(${dimBlur}px) saturate(160%)`,
            backgroundColor: "rgba(0,0,0,0.92)",
          }}
        />,
        document.body
      )}

      {isFullscreen && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 10000 }}>
          <div className="absolute inset-0" onClick={(e) => { if (e.target.closest("[data-glass-controls]")) return; togglePlay(); resetHideTimer(); }} onMouseMove={resetHideTimer} onTouchStart={resetHideTimer} />
          {!playing && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10001 }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-xl">
                <Play size={32} className="text-white ml-1" fill="white" />
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10001 }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-xl">
                <div className="h-7 w-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            </div>
          )}
          {title && (
            <div className="absolute left-3" style={{ zIndex: 10001, bottom: showControls ? "64px" : "20px", transition: "bottom 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
              <div className="rounded-lg bg-black/50 backdrop-blur-md border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center justify-center" style={{ padding: "3px 8px", lineHeight: "20px" }}>
                <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{title}</span>
              </div>
            </div>
          )}
          <div data-glass-controls className={`absolute bottom-0 left-0 right-0 transition-transform duration-300 ease-out`} style={{ zIndex: 10001, marginBottom: "max(0.375rem, env(safe-area-inset-bottom, 0.375rem))", transform: showControls ? "translateY(0)" : "translateY(16px)", pointerEvents: showControls ? "auto" : "none" }} onClick={(e) => e.stopPropagation()}>
            <div className={`mx-1.5 mb-1.5 rounded-xl border border-white/[0.08] bg-black/63 backdrop-blur-md transition-opacity duration-300 relative z-[5] ${showControls ? "opacity-100" : "opacity-0"}`}>
              <div className="flex items-center gap-1.5 px-2 py-1">
                <button onClick={togglePlay} className="shrink-0 text-white hover:text-white/80 transition-colors cursor-pointer">
                  {playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                </button>
                <span className="text-[11px] font-medium text-white/70 tabular-nums shrink-0 select-none">{formatTime(currentTime)} / {formatTime(duration)}</span>
                <div className="flex-1 mx-2 relative flex items-center h-7">
                  <div className="absolute left-0 right-0 h-1 rounded-full pointer-events-none" style={{ background: `linear-gradient(to right, #ffffff ${progress}%, rgba(255,255,255,0.15) ${progress}%)` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none" style={{ left: `calc(${progress}% - 6px)` }} />
                  <input type="range" min="0" max="1000" step="1" value={Math.round(inputValue)} onInput={handleInput} onMouseDown={handlePointerDown} onMouseUp={handlePointerUp} onTouchStart={handlePointerDown} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer opacity-0 z-10 m-0 p-0" style={{ WebkitAppearance: "none", MozAppearance: "none" }} />
                </div>
                <button ref={volumeBtnRef} onClick={toggleMute} onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }} onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }} className="shrink-0 text-white/70 hover:text-white transition-colors flex items-center justify-center relative z-[60] cursor-pointer">
                  {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button onClick={toggleFullscreen} className="shrink-0 text-white/70 hover:text-white transition-colors relative z-[60] cursor-pointer">
                  <Maximize size={16} />
                </button>
              </div>
            </div>
            <div
              className="absolute overflow-hidden rounded-lg bg-black/50 backdrop-blur-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
              style={{ bottom: showVolume ? "calc(1.5rem + 24px)" : "1.5rem", height: showVolume ? "80px" : "calc(100% - 3rem)", transition: "height 0.3s cubic-bezier(0.4,0,0.2,1), bottom 0.3s cubic-bezier(0.4,0,0.2,1)", pointerEvents: showVolume ? "auto" : "none", width: "36px", right: "26px", zIndex: 1 }}
              onMouseEnter={() => { clearTimeout(volumeTimer.current); setShowVolume(true); }}
              onMouseLeave={() => { if (!volumeDragging) volumeTimer.current = setTimeout(() => setShowVolume(false), 300); }}
            >
              <div ref={volumeRef} className="absolute bottom-2 left-1/2 -translate-x-1/2 h-[64px] w-5 cursor-pointer touch-none select-none" style={{ opacity: showVolume ? 1 : 0, transition: "opacity 0.3s" }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setVolumeDragging(true); volumeRef.current?.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!volumeDragging) return; e.preventDefault(); setVolumeFromY(e.clientY); }} onPointerUp={(e) => { setVolumeDragging(false); volumeRef.current?.releasePointerCapture(e.pointerId); }}>
                <div className="absolute bottom-[3px] top-[3px] left-1/2 -translate-x-1/2 w-[2px] rounded-full bg-white/15 pointer-events-none" />
                <div className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-[2px] rounded-full bg-white pointer-events-none" style={{ height: `calc(${(muted ? 0 : volume) * 58}px)` }} />
                <div className="absolute left-1/2 -translate-x-1/2 h-[7px] w-[7px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] pointer-events-none" style={{ bottom: `calc(${(muted ? 0 : volume) * 58}px)` }} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Account Card ────────────────────────────────────────────────────────────

export default function AccountCard({ account, currency, rates, category, onBuy, onRent }) {
  const isRent = account.category === "rent";
  const normalizedStatus = account.status === "В наличии" || account.status === "available" ? "available" : account.status;
  const isAvailable = normalizedStatus === "available";
  const busyUntil = account.rent_expires_at || null;
  const busyLabel = isRent && !isAvailable ? (busyUntil ? `ЗАНЯТ до ${formatBusyTime(busyUntil)}` : "ЗАНЯТ") : null;
  const statusLabel = busyLabel || (isAvailable ? "В НАЛИЧИИ" : "ЗАНЯТ");
  const statusIsAvailable = isAvailable;
  const curr = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  const [selectedTerm, setSelectedTerm] = useState(
    isRent && account.rentTerms?.length ? account.rentTerms[0] : null
  );
  const [showTerms, setShowTerms] = useState(false);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [isCardFullscreen, setIsCardFullscreen] = useState(false);
  const dropdownRef = useRef(null);
  const tagsRef = useRef(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });
  const [maskStyle, setMaskStyle] = useState("");
  const [posterSrc, setPosterSrc] = useState(null);
  const bottomBarRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);

  const updateFades = () => {
    const el = tagsRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) { setMaskStyle(""); return; }
    const left = Math.min(50, el.scrollLeft);
    const right = Math.min(50, maxScroll - el.scrollLeft);
    setMaskStyle(`linear-gradient(to right, transparent 0%, black ${left}px, black calc(100% - ${right}px), transparent 100%)`);
  };

  const displayPrice = isRent && selectedTerm ? selectedTerm.price : (account.price || 0);
  const fromCurrency = isRent && selectedTerm ? (selectedTerm.currency || "RUB") : (account.currency || "RUB");
  const converted = convertPrice(displayPrice, fromCurrency, currency, rates);
  const formattedPrice = (converted || 0).toLocaleString("ru-RU");
  const hasVideo = !!account.video_url;
  const videoSrc = hasVideo
    ? (account.video_url.startsWith("http") ? account.video_url : API_URL + account.video_url)
    : null;

  useEffect(() => {
    if (!showTerms) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowTerms(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTerms]);

  useEffect(() => {
    if (isRent && account.tags?.length > 0) {
      requestAnimationFrame(updateFades);
    }
  }, [isRent, account.tags]);

  useEffect(() => {
    if (!hasVideo || !videoSrc) return;
    // Prefer server-generated thumbnail
    if (account.thumbnail_url) {
      setPosterSrc(account.thumbnail_url);
      return;
    }
    // Fallback: extract from video via proxy
    const cacheKey = `poster-${videoSrc}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setPosterSrc(cached);
      return;
    }
    extractPoster(videoSrc).then((url) => {
      if (url) {
        sessionStorage.setItem(cacheKey, url);
        setPosterSrc(url);
      }
    });
  }, [videoSrc, hasVideo]);

  useEffect(() => {
    const el = bottomBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setIsCompact(entry.contentRect.width < 280);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative rounded-2xl border border-white/5 bg-[#1A1A1A] shadow-2xl shadow-black/80">
      {hasVideo ? (
        <GlassPlayer src={videoSrc} poster={posterSrc || undefined} title={account.title} statusLabel={statusLabel} statusIsAvailable={statusIsAvailable} videoHidden={showExtraInfo} onFullscreenChange={setIsCardFullscreen} initialDuration={account.duration} />
      ) : (
        <div className="relative w-full aspect-video bg-[#111]" style={{ clipPath: "inset(0 round 1rem 1rem 0 0)" }}>
          <img src={account.image_url || "/placeholder.svg"} alt={account.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-3 left-3 z-30">
            <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${statusIsAvailable ? "bg-white text-black" : "bg-neutral-700 text-neutral-400"}`}>{statusLabel}</div>
          </div>
          <div className="absolute bottom-20 left-3 z-30">
            <div className="rounded-lg bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              <span className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{account.title}</span>
            </div>
          </div>
        </div>
      )}

      {hasVideo && showExtraInfo && (
        <img src={posterSrc || "/placeholder.svg"} alt="" className="absolute inset-0 w-full h-full object-cover z-10" style={{ clipPath: "inset(0 round 1rem)" }} />
      )}

      {isRent && account.tags?.length > 0 && (
        <div className="relative bg-[#1A1A1A] px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative overflow-hidden">
              <div
                ref={tagsRef}
                className="flex items-center gap-2 overflow-x-auto cursor-grab active:cursor-grabbing"
                onScroll={updateFades}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  maskImage: maskStyle || "none",
                  WebkitMaskImage: maskStyle || "none",
                }}
                onMouseDown={(e) => {
                  const el = tagsRef.current;
                  if (!el) return;
                  dragState.current.isDragging = true;
                  dragState.current.startX = e.pageX;
                  dragState.current.scrollLeft = el.scrollLeft;
                  el.style.scrollBehavior = "auto";
                }}
                onMouseLeave={() => { dragState.current.isDragging = false; tagsRef.current && (tagsRef.current.style.scrollBehavior = ""); }}
                onMouseUp={() => { dragState.current.isDragging = false; tagsRef.current && (tagsRef.current.style.scrollBehavior = ""); }}
                onMouseMove={(e) => {
                  if (!dragState.current.isDragging) return;
                  e.preventDefault();
                  const el = tagsRef.current;
                  if (!el) return;
                  el.scrollLeft = dragState.current.scrollLeft - (e.pageX - dragState.current.startX);
                }}
              >
                {account.tags.map((tag, i) => (
                  <span key={i} className="shrink-0 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/70 whitespace-nowrap select-none">{tag}</span>
                ))}
              </div>
            </div>
            {account.description?.content && (
              <button onClick={() => setShowExtraInfo(true)} className="shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.1] backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:text-white/80 hover:bg-white/[0.07] hover:border-white/[0.15] transition-all whitespace-nowrap select-none cursor-pointer" style={{ transform: "translateZ(0)", willChange: "backdrop-filter" }}>Доп. инфо</button>
            )}
          </div>
        </div>
      )}

      <div className="relative bg-[#1A1A1A] rounded-b-2xl">
        {hasVideo && (
          <video src={`${videoSrc}#t=0.001`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 pointer-events-none" />
        )}
        <div ref={bottomBarRef} className={`relative z-50 flex gap-2 px-3 sm:px-4 py-3 ${isCompact ? "flex-col" : "flex-row items-center justify-between"}`}>
          {isRent ? (
            <div className={`w-full ${isCompact ? "flex flex-col gap-2" : "flex flex-row items-center justify-between gap-2"}`}>
              <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                <button onClick={() => setShowTerms(!showTerms)} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] backdrop-blur-md border border-white/10 px-3 py-2 transition-all hover:border-white/10 cursor-pointer">
                  <span className="text-xs sm:text-sm font-bold text-white truncate">{selectedTerm ? <>{getTermLabel(selectedTerm)}<span className="ml-2 text-neutral-400 font-normal whitespace-nowrap">{formattedPrice} {curr.symbol}</span></> : "—"}</span>
                  <ChevronDown size={14} className={`text-white/50 transition-transform duration-200 ${showTerms ? "rotate-180" : ""}`} />
                </button>
                <div
                  className="absolute bottom-full left-0 mb-2 border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden w-full min-w-[200px] max-h-60 overflow-y-auto"
                  style={{
                    zIndex: 100,
                    transform: showTerms ? "translateZ(0) translateY(0)" : "translateZ(0) translateY(8px)",
                    opacity: showTerms ? 1 : 0,
                    transition: "opacity 0.2s ease, transform 0.2s ease",
                    willChange: "transform, opacity",
                    backdropFilter: "blur(24px) saturate(140%)",
                    WebkitBackdropFilter: "blur(24px) saturate(140%)",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.7)",
                    pointerEvents: showTerms ? "auto" : "none",
                  }}
                >
                    {account.rentTerms.filter(t => !t.type).map((term, i) => (
                      <button key={`r-${i}`} onClick={() => { setSelectedTerm(term); setShowTerms(false); }} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-all cursor-pointer ${selectedTerm?.durationMs === term.durationMs && !selectedTerm?.type ? "text-white border-l-2 border-l-white/40 bg-white/[0.06]" : "text-white/70 hover:bg-white/[0.04]"} ${i > 0 || account.rentTerms.filter(t => t.type).length > 0 ? "border-t border-white/[0.06]" : ""}`}>
                        <span className="text-xs sm:text-sm font-bold truncate">{getTermLabel(term)}</span>
                        <span className="text-xs sm:text-sm whitespace-nowrap shrink-0">{convertPrice(term.price, term.currency || "RUB", currency, rates).toLocaleString("ru-RU")} {curr.symbol}</span>
                      </button>
                    ))}
                    {account.rentTerms.filter(t => t.type === "special").map((term, i) => (
                      <button key={`s-${i}`} onClick={() => { setSelectedTerm(term); setShowTerms(false); }} className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-all cursor-pointer ${selectedTerm?.type === "special" && selectedTerm?.name === term.name ? "text-white border-l-2 border-l-blue-400 bg-blue-500/10" : "text-blue-300/70 hover:bg-blue-500/5"} ${i > 0 || account.rentTerms.filter(t => !t.type).length > 0 ? "border-t border-white/[0.06]" : ""}`}>
                        <span className="text-xs sm:text-sm font-bold truncate">{getTermLabel(term)}</span>
                        <span className="text-sm whitespace-nowrap shrink-0">{convertPrice(term.price, term.currency || "RUB", currency, rates).toLocaleString("ru-RU")} {curr.symbol}</span>
                      </button>
                    ))}
                  </div>
              </div>
              <button onClick={isAvailable && selectedTerm ? () => onRent(account, selectedTerm) : undefined} className={`rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${isCompact ? "w-full" : "whitespace-nowrap"} ${isAvailable ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-800 text-neutral-600 cursor-not-allowed"}`} disabled={!isAvailable || !selectedTerm}>Арендовать</button>
            </div>
          ) : (
            <div className={`w-full ${isCompact ? "flex flex-col gap-2" : "flex items-center justify-between"}`}>
              <span className="text-xl font-bold text-white">{formattedPrice}<span className="ml-1 text-sm text-neutral-500">{curr.symbol}</span></span>
              <button onClick={isAvailable ? onBuy : undefined} className={`rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${isCompact ? "w-full" : "whitespace-nowrap"} ${isAvailable ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-800 text-neutral-600 active:scale-100 cursor-not-allowed"}`} disabled={!isAvailable}>Купить</button>
            </div>
          )}
        </div>
      </div>

      {showExtraInfo && (
        <div
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center p-6 font-mono overflow-hidden"
          style={{
            clipPath: "inset(0 round 1rem)",
            transform: "translateZ(0)",
            willChange: "transform",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            backgroundColor: "rgba(0,0,0,0.85)",
            boxShadow: "inset 0 0 0 2px #0b0b0b, inset 0 0 8px 0 rgba(0,0,0,0.6)",
          }}
        >
          <button onClick={() => setShowExtraInfo(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer text-lg leading-none">✕</button>
          <div className="text-left w-full max-w-sm">
            <p className="text-lg font-bold text-white mb-5">{account.description?.title || "Дополнительная информация:"}</p>
            <p className="text-base text-white/80 leading-relaxed whitespace-pre-wrap">{account.description?.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
