// middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// إنشاء مجلد uploads لو مش موجود
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد التخزين المحلي
const storage = multer.diskStorage({
      destination: (req, file, cb) => {
            cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const uniqueName = `result_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
            cb(null, uniqueName);
      }
});

// فلترة الملفات (صور و PDF فقط)
const fileFilter = (req, file, cb) => {
      if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
            cb(null, true);
      } else {
            cb(new Error("نوع الملف غير مسموح. ارسل صور أو PDF فقط."), false);
      }
};

const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter
});

module.exports = upload;
