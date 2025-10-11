// S3-only uploads use in-memory storage; keep this file to avoid breaking imports
const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = upload;
