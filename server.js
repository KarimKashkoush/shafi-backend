const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const pool = require("./db");
const authRoutes = require("./routes/routes");

const app = express();

// ================= STATIC =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= CONFIG =================
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
      "https://shafi-d5v1x5yu5-karimkashkoushs-projects.vercel.app",
      "https://shafi-gilt.vercel.app",
      "https://shafi-front-end.vercel.app",
      "http://localhost:5173",
      "https://www.shafi-healthcare.com",
      "https://shafi-healthcare.com"
];

// ================= CORS =================
app.use(
      cors({
            origin: (origin, callback) => {
                  // allow server-to-server / curl / postman
                  if (!origin) return callback(null, true);

                  if (!allowedOrigins.includes(origin)) {
                        return callback(new Error("Not allowed by CORS"), false);
                  }

                  callback(null, true);
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
      })
);

// ================= BODY PARSER =================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ================= ROUTES =================
app.use("/", authRoutes);

// ================= DB CHECK =================
pool.query("SELECT NOW()", (err, result) => {
      if (err) {
            console.error("❌ Database connection error:", err);
      } else {
            console.log("📦 Database connected ✅", result.rows[0]);
      }
});

// ================= START SERVER =================
const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
});

// ================= GRACEFUL SHUTDOWN =================
const shutdown = () => {
      console.log("🛑 Shutting down server...");
      server.close(() => {
            pool.end(() => {
                  console.log("✅ Server & DB closed");
                  process.exit(0);
            });
      });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
