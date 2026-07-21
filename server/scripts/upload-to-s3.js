require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const ycS3 = require("../lib/yc-s3");

const PRODUCTS_FILE = path.join(__dirname, "..", "data", "products.json");
const VIDEOS_DIR = path.join(__dirname, "..", "public", "uploads", "videos");

async function migrate() {
  if (!ycS3.isConfigured()) {
    console.error("S3 is not configured. Check YC_ACCESS_KEY, YC_SECRET_KEY, YC_BUCKET in server/.env");
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  let changed = false;

  for (const p of products) {
    if (!p.video_url || p.video_url.startsWith("http")) {
      console.log(`[SKIP] ${p.title} — no local video or already S3 URL`);
      continue;
    }

    const localPath = path.join(__dirname, "..", "public", p.video_url);
    if (!fs.existsSync(localPath)) {
      console.log(`[SKIP] ${p.title} — file not found: ${localPath}`);
      continue;
    }

    console.log(`[UPLOAD] ${p.title} — ${localPath}`);
    const buffer = fs.readFileSync(localPath);
    const result = await ycS3.uploadBuffer(buffer, path.basename(localPath), "video/mp4");
    console.log(`[DONE] ${p.title} → ${result.publicUrl}`);
    p.video_url = result.publicUrl;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
    console.log("\n[SAVED] products.json updated with S3 URLs");
  } else {
    console.log("\n[NO-OP] No videos were migrated");
  }
}

migrate().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
