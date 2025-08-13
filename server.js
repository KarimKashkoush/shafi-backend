const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require("path");
const authRoutes = require('./routes/routes');

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
const allowedOrigins = [
      "https://shafi-d5v1x5yu5-karimkashkoushs-projects.vercel.app",
      "https://shafi-gilt.vercel.app",
      "http://localhost:5173"
];

app.use(cors({
      origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                  const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                  return callback(new Error(msg), false);
            }
            return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
}));


app.use(express.json());
app.use('/', authRoutes);


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
