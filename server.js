const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require("path");
const pool = require('./db');
const authRoutes = require('./routes/routes');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ✅ أمان وتحليل طلبات
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ السماح بالمصادر (CORS)
const allowedOrigins = [
      "https://shafi-front-end.vercel.app",
      "https://shafi-gilt.vercel.app",
      "https://shafi-d5v1x5yu5-karimkashkoushs-projects.vercel.app",
      "http://localhost:5173"
];

app.use(cors({
      origin: function (origin, callback) {
            if (!origin) return callback(null, true);

            // ✅ يقبل الدومينات اللي تبدأ بالكلمة دي
            const isAllowed = allowedOrigins.some(o => origin.startsWith(o));

            if (!isAllowed) {
                  console.log("🚫 Forbidden Origin:", origin);
                  return callback(null, false);
            }

            return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
}));


// ✅ تحديد عدد الطلبات (Rate Limiting)
const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      message: { message: "تم تجاوز الحد المسموح من الطلبات، حاول لاحقًا" }
});
app.use(limiter);

// ✅ Body Parser
app.use(express.json());

// ✅ Routes
app.use('/', authRoutes);

// ✅ Health Check
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// ✅ اختبار الاتصال بقاعدة البيانات
pool.query('SELECT NOW()', (err, result) => {
      if (err) {
            console.error('❌ Database connection error:', err);
      } else {
            console.log('📦 Database connected ✅', result.rows[0]);
      }
});

// ✅ Error Handler (مركزي)
app.use((err, req, res, next) => {
      console.error('🔥 Unhandled error:', err.message || err);
      res.status(500).json({ message: 'خطأ داخلي في السيرفر', error: err.message });
});

// ✅ تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
