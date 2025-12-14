const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log("Decoded JWT:", decoded); // << مهمة جدا للتأكد
            req.user = {
                  id: decoded.id,   // لازم يكون موجود
                  role: decoded.role
            };
            next();
      } catch (err) {
            return res.status(401).json({ message: "Invalid token" });
      }
};

module.exports = { authMiddleware };
