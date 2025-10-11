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

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());
app.use(cors({
      origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (corsOrigins.indexOf(origin) === -1) {
                  const msg = 'Origin not allowed by CORS';
                  return callback(new Error(msg), false);
            }
            return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
}));

const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300
});
app.use(limiter);

app.use(express.json());
app.use('/', authRoutes);

// ✅ اختبار الاتصال بقاعدة البيانات
pool.query('SELECT NOW()', (err, result) => {
      if (err) {
            console.error('❌ Database connection error:', err);
      } else {
            console.log('📦 Database connected ✅', result.rows[0]);
      }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// Health check
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({ message: 'خطأ داخلي في السيرفر' });
});
