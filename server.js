const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require("path");

const authRoutes = require('./routes/routes'); // ده المسار اللي فيه /register

const app = express();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cors({
      origin: "http://localhost:5173",  
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
}));
app.use(express.json());
app.use('/', authRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
