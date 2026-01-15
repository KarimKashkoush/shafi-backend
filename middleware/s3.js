// middleware/s3.js
// AWS SDK v3 - S3 helpers: upload (server-side), presigned upload, delete
// Best practice: use IAM Role on EC2 (no static keys)

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// =========================
// 1) Config + Client
// =========================

const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Optional: set a prefix like "results/" or "uploads/"
const S3_PREFIX = process.env.AWS_S3_PREFIX || "results/";

if (!AWS_REGION) throw new Error("Missing env: AWS_REGION");
if (!AWS_BUCKET_NAME) throw new Error("Missing env: AWS_BUCKET_NAME");

/**
 * IMPORTANT:
 * - If you are on EC2, DO NOT set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY.
 * - Attach an IAM Role to the instance with S3 permissions.
 * - SDK will automatically pick role credentials.
 */
const s3 = new S3Client({
  region: AWS_REGION,
  // credentials: undefined -> uses default provider chain (IAM role, etc.)
});

// =========================
// 2) Helpers
// =========================

const sanitizeFilename = (name = "file") => {
  // keep only safe chars
  return name.replace(/[^\w.\-]+/g, "_");
};

const getExt = (filename = "") => {
  const ext = path.extname(filename).toLowerCase();
  return ext || "";
};

const randomId = (len = 16) => crypto.randomBytes(len).toString("hex");

const buildObjectKey = (originalName = "file", folder = S3_PREFIX) => {
  // Example: results/2026/01/15/1700000000000-<rand>-file.jpg
  const safe = sanitizeFilename(originalName);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const stamp = Date.now();
  const rid = randomId(6);
  const ext = getExt(safe);

  const base = safe.replace(ext, "");
  const finalName = `${stamp}-${rid}-${base}${ext}`;

  const normalizedFolder = folder.endsWith("/") ? folder : `${folder}/`;
  return `${normalizedFolder}${yyyy}/${mm}/${dd}/${finalName}`;
};

const buildPublicUrl = (bucket, region, key) => {
  // Standard virtual-hosted style URL
  // NOTE: If you use CloudFront/custom domain, change this.
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
};

const stripQuery = (urlOrKey) => {
  if (!urlOrKey) return "";
  return String(urlOrKey).split("?")[0];
};

const extractKeyFromUrl = (fileUrl) => {
  // Works for typical: https://bucket.s3.region.amazonaws.com/key
  // Also handles query string.
  const clean = stripQuery(fileUrl);
  const idx = clean.indexOf(".amazonaws.com/");
  if (idx === -1) {
    // Maybe user stored key already
    return clean;
  }
  return clean.substring(idx + ".amazonaws.com/".length);
};

// =========================
// 3) Server-side upload (current flow)
// =========================

/**
 * Upload a file received by multer to S3.
 * Supports:
 *  - multer memoryStorage => file.buffer
 *  - multer diskStorage   => file.path
 *
 * Returns:
 *  { key, url, bucket, contentType, size }
 */
async function uploadFileToS3(file, options = {}) {
  if (!file) throw new Error("uploadFileToS3: missing file");

  const folder = options.folder || S3_PREFIX;
  const key = options.key || buildObjectKey(file.originalname || "file", folder);
  const contentType = file.mimetype || options.contentType || "application/octet-stream";

  let bodyStream = null;
  let contentLength = null;

  // ✅ diskStorage
  if (file.path) {
    const stat = fs.statSync(file.path);
    contentLength = stat.size;
    bodyStream = fs.createReadStream(file.path);
  }
  // ✅ memoryStorage
  else if (file.buffer) {
    const { Readable } = require("stream");
    contentLength = file.buffer.length;
    bodyStream = Readable.from(file.buffer);
  } else {
    throw new Error("uploadFileToS3: file has no path or buffer. Check multer storage.");
  }

  // ✅ fallback لو multer مديك size
  if (!contentLength && typeof file.size === "number") {
    contentLength = file.size;
  }

  if (!contentLength) {
    throw new Error("uploadFileToS3: ContentLength is missing (file.size/buffer/stat).");
  }

  const cmd = new PutObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: key,
    Body: bodyStream,
    ContentType: contentType,
    ContentLength: contentLength, // ✅ مهم جدًا
  });

  await s3.send(cmd);

  const url = buildPublicUrl(AWS_BUCKET_NAME, AWS_REGION, key);

  return {
    bucket: AWS_BUCKET_NAME,
    key,
    url,
    contentType,
    size: contentLength,
  };
}


// =========================
// 4) Presigned upload (recommended flow)
// =========================

/**
 * Generate a presigned URL for direct client upload.
 *
 * Input:
 *  - originalName (string)
 *  - contentType  (string)
 *  - folder (optional)
 *  - expiresIn (seconds) default 60
 *
 * Returns:
 *  { key, uploadUrl, url }
 */
async function createPresignedUpload({ originalName, contentType, folder, expiresIn = 60 }) {
  if (!originalName) throw new Error("createPresignedUpload: originalName is required");
  if (!contentType) throw new Error("createPresignedUpload: contentType is required");

  const key = buildObjectKey(originalName, folder || S3_PREFIX);

  const cmd = new PutObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });

  const url = buildPublicUrl(AWS_BUCKET_NAME, AWS_REGION, key);

  return { key, uploadUrl, url };
}

// =========================
// 5) Delete from S3
// =========================

/**
 * Delete object by key OR by full URL.
 * Returns true if request sent successfully.
 */
async function deleteFromS3(keyOrUrl) {
  if (!keyOrUrl) return false;

  const key = keyOrUrl.includes("amazonaws.com/")
    ? extractKeyFromUrl(keyOrUrl)
    : stripQuery(keyOrUrl);

  if (!key) return false;

  const cmd = new DeleteObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: key,
  });

  await s3.send(cmd);
  return true;
}

module.exports = {
  s3,
  uploadFileToS3,
  createPresignedUpload,
  deleteFromS3,
  buildObjectKey,
  extractKeyFromUrl,
};
