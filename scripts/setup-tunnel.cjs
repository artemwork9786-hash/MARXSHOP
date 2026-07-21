/**
 * setup-tunnel.cjs — запускает бэк + туннель в фоне, ловит URL, обновляет .env, выходит.
 *
 * Подход для Windows:
 *   1. Сервер запускается detached + unref (выживает после выхода родителя).
 *   2. Туннель запускается ОБЫЧНЫМ процессом с piped stdout для чтения URL.
 *   3. После получения URL — перезапускается через `start /b` как detached.
 *   4. Скрипт завершается, процессы остаются в фоне.
 *
 * Использование: node scripts/setup-tunnel.cjs
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "server");
const ENV_PATH = path.join(ROOT, ".env");

// ─── Шаг 1: Убить старые процессы на порту 5000 ────────────────────────────

console.log("[1/4] Очистка порта 5000...");
try {
  const out = execSync('netstat -ano | findstr :5000 | findstr LISTENING', {
    encoding: "utf8",
    shell: true,
  });
  const lines = out.trim().split("\n");
  for (const line of lines) {
    const pid = line.trim().split(/\s+/).pop();
    if (pid && pid !== "0") {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore", shell: true });
        console.log(`    Убит PID ${pid}`);
      } catch {}
    }
  }
} catch {
  console.log("    Порт свободен");
}

// ─── Шаг 2: Запуск сервера (detached, выживает) ────────────────────────────

console.log("[2/4] Запуск Express-сервера на порту 5000...");
const server = spawn("node", ["server.js"], {
  cwd: SERVER_DIR,
  stdio: "ignore",
  detached: true,
  shell: true,
});
server.unref();

// ─── Шаг 3: Запуск туннеля (обычный процесс, для чтения URL) ───────────────

console.log("[3/4] Запуск localtunnel (временно для получения URL)...");
const tunnel = spawn("npx", ["localtunnel", "--port", "5000"], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  // НЕ detached — нужен piped stdout
});

tunnel.stderr.on("data", (d) => {
  process.stderr.write("[TUNNEL ERR] " + d);
});

const rl = readline.createInterface({ input: tunnel.stdout });

const urlPromise = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error("Туннель не дал URL за 30 секунд"));
  }, 30000);

  rl.on("line", (line) => {
    process.stdout.write("[TUNNEL] " + line + "\n");
    const match = line.match(/https?:\/\/[^\s]+\.loca\.lt[^\s]*/);
    if (match) {
      clearTimeout(timer);
      resolve(match[0].trim());
    }
  });
});

(async () => {
  try {
    const url = await urlPromise;

    // Убиваем временный туннель (он больше не нужен)
    tunnel.kill();
    rl.close();

    // Перезапускаем туннель через `start /b` (truly detached на Windows)
    console.log("    Перезапуск туннеля в фоне...");
    spawn("cmd", ["/c", "start", "/b", "npx", "localtunnel", "--port", "5000"], {
      cwd: ROOT,
      stdio: "ignore",
      shell: false,
    });

    // ─── Шаг 4: Обновить .env ─────────────────────────────────────────────
    console.log("[4/4] Обновление .env...");
    fs.writeFileSync(ENV_PATH, `VITE_API_URL=${url}\n`, "utf-8");

    console.log(`\nТуннель активен: ${url}`);
    console.log("Можно собирать фронт: npm run build && npm run deploy\n");

    process.exit(0);
  } catch (err) {
    console.error("\nОШИБКА:", err.message);
    try { tunnel.kill(); } catch {}
    try { server.kill(); } catch {}
    process.exit(1);
  }
})();
