const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, "server");
const ENV_PATH = path.join(ROOT, ".env");

(async () => {
  console.log("=== MARXSHOP Pipeline ===\n");

  // Step 1: Start Express server (detached via start /b on Windows)
  console.log("[1/5] Starting backend server on port 5000...");
  spawn("cmd", ["/c", "start", "/b", "node", "server.js"], {
    cwd: SERVER_DIR,
    stdio: "ignore",
    shell: false,
  });

  // Step 2: Wait for server to be ready
  console.log("[2/5] Waiting for server to start...");
  await new Promise((r) => setTimeout(r, 3000));

  // Step 3: Start localtunnel and capture URL
  console.log("[3/5] Starting localtunnel...");
  const tunnel = spawn("npx", ["localtunnel", "--port", "5000"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  tunnel.stdout.on("data", (d) => {
    process.stdout.write("[TUNNEL] " + d);
  });

  tunnel.stderr.on("data", (d) => {
    process.stderr.write("[TUNNEL ERR] " + d);
  });

  const rl = readline.createInterface({ input: tunnel.stdout });

  let tunnelUrl = null;

  const urlPromise = new Promise((resolve, reject) => {
    rl.on("line", (line) => {
      if (!tunnelUrl) {
        const match = line.match(/https?:\/\/[^\s]+\.loca\.lt[^\s]*/);
        if (match) {
          tunnelUrl = match[0].trim();
          resolve(tunnelUrl);
        }
      }
    });
    setTimeout(() => reject(new Error("Tunnel did not provide URL in 60s")), 60000);
  });

  try {
    const url = await urlPromise;
    console.log(`\n>>> TUNNEL URL: ${url}`);

    // Step 4: Update .env
    console.log("[4/5] Writing VITE_API_URL to .env...");
    fs.writeFileSync(ENV_PATH, `VITE_API_URL=${url}\n`, "utf-8");
    console.log(`    .env updated: ${ENV_PATH}`);

    // Step 5: Build frontend
    console.log("[5/5] Building frontend...");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit", shell: true });

    console.log("\n=== PIPELINE COMPLETE ===");
    console.log(`Backend:  http://localhost:5000`);
    console.log(`Tunnel:   ${url}`);
    console.log(`Frontend: built to dist/`);
    console.log(`Deploy:   npm run deploy`);
  } catch (err) {
    console.error("\nPIPELINE FAILED:", err.message);
    tunnel.kill();
    process.exit(1);
  }

  console.log("\nServer and tunnel running. Ctrl+C to stop.");
})();
