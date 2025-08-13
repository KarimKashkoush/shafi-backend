const jwt = require('jsonwebtoken');
const JWT_SECRET = "your_secret_key"; // خليها زي ما عندك في ملف .env

function authenticateToken(req, res, next) {
      // جايب التوكن من هيدر Authorization بصيغة: "Bearer token..."
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
            return res.status(401).json({ message: 'مفيش توكن، الدخول مرفوض' });
      }

      jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                  return res.status(403).json({ message: 'التوكن غير صالح أو منتهي' });
            }

            req.user = user;
            next(); 
      });
}

module.exports = authenticateToken;
