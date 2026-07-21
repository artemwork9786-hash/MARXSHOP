import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// ─── Telegram Mini App Cache Buster ──────────────────────────────────────────
// Unique build identifier — changes on every deploy
const BUILD_ID = "marxshop_v_" + import.meta.env.VITE_BUILD_TIME;
const STORAGE_KEY = "marxshop_build_id";

try {
  const prevBuild = localStorage.getItem(STORAGE_KEY);
  if (prevBuild && prevBuild !== BUILD_ID) {
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    // Don't hard reload in Telegram Mini App — it loses WebApp context
    const isTelegram = !!window.Telegram?.WebApp;
    if (!isTelegram) {
      window.location.reload(true);
      throw new Error("Cache busting — reloading");
    }
  }
  localStorage.setItem(STORAGE_KEY, BUILD_ID);
} catch (e) {
  if (e.message !== "Cache busting — reloading") {
    console.warn("[CACHE-BUST]", e.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
