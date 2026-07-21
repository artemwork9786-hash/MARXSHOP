/**
 * setup-local.cjs — запускает бэк + Vite dev server в фоне, показывает URL, выходит.
 *
 * Использование: node scripts/setup-local.cjs
 * Или: npm run local
 */

const { spawn, execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "server");

// ─── Шаг 1: Убить старые процессы ──────────────────────────────────────────

console.log("[1/3] Очистка портов 5000 и 5173...");
for (const port of [5000, 5173]) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: "utf8",
      shell: true,
    });
    const lines = out.trim().split("\n");
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== "0") {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore", shell: true });
          console.log(`    Убит PID ${pid} (порт ${port})`);
        } catch {}
      }
    }
  } catch {
    console.log(`    Порт ${port} свободен`);
  }
}

// ─── Шаг 2: Запуск Express-сервера (detached) ──────────────────────────────

console.log("[2/3] Запуск Express-сервера на порту 5000...");
const server = spawn("node", ["server.js"], {
  cwd: SERVER_DIR,
  stdio: "ignore",
  detached: true,
  shell: true,
});
server.unref();

// ─── Шаг 3: Запуск Vite dev server (detached) ─────────────────────────────

console.log("[3/3] Запуск Vite dev server...");
const vite = spawn("npx", ["vite", "--host", "--port", "5173"], {
  cwd: ROOT,
  stdio: "ignore",
  detached: true,
  shell: true,
});
vite.unref();

// ─── Вывод URL ─────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Сервер:   http://localhost:5000");
  console.log("  Фронт:    http://localhost:5173/MARXSHOP/");
  console.log("═══════════════════════════════════════════════════");
  console.log("\nКак открыть в Telegram:");
  console.log("  1. Скопируй ссылку выше");
  console.log("  2. Отправь СЕБЕ В ЧАТ в Telegram");
  console.log("  3. Кликни по ссылке — Mini App откроется\n");
  process.exit(0);
}, 2000);
