const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require("path");
const authRoutes = require('./routes/routes');

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.use(cors({
      origin: process.env.CLIENT_URL || PORT,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
}));

app.use(express.json());
app.use('/', authRoutes);


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
