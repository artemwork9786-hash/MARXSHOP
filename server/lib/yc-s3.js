const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const BUCKET = process.env.YC_BUCKET || "marx-shop-videos";
const REGION = process.env.YC_REGION || "ru-central1";
const ACCESS_KEY = process.env.YC_ACCESS_KEY || "";
const SECRET_KEY = process.env.YC_SECRET_KEY || "";
const PUBLIC_URL = process.env.YC_PUBLIC_URL || "";

const s3 = new S3Client({
  region: REGION,
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: true,
});

function isConfigured() {
  return !!(ACCESS_KEY && SECRET_KEY && BUCKET);
}

function makeKey(filename) {
  const ext = filename.split(".").pop() || "mp4";
  return `videos/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
}

function publicUrlForKey(key) {
  return PUBLIC_URL
    ? `${PUBLIC_URL}/${key}`
    : `https://storage.yandexcloud.net/${BUCKET}/${key}`;
}

async function getPresignedUploadUrl(filename, contentType) {
  const key = makeKey(filename);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || "video/mp4",
    ACL: "public-read",
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { uploadUrl, key, publicUrl: publicUrlForKey(key) };
}

async function uploadBuffer(buffer, filename, contentType) {
  const key = makeKey(filename);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || "video/mp4",
    ACL: "public-read",
  }));

  return { key, publicUrl: publicUrlForKey(key) };
}

async function deleteVideo(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error("[S3] Delete error:", err.message);
  }
}

const PRODUCTS_KEY = "data/products.json";

async function readJson(key) {
  if (!isConfigured()) return null;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const str = await res.Body.transformToString("utf-8");
    return JSON.parse(str);
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
    console.error(`[S3] Read error (${key}):`, err.message);
    return null;
  }
}

async function writeJson(key, data) {
  if (!isConfigured()) return false;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    }));
    return true;
  } catch (err) {
    console.error(`[S3] Write error (${key}):`, err.message);
    return false;
  }
}

module.exports = { isConfigured, getPresignedUploadUrl, uploadBuffer, deleteVideo, readJson, writeJson, PRODUCTS_KEY, s3, publicUrlForKey };
