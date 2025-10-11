const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
            return res.status(401).json({ message: 'مفيش توكن، الدخول مرفوض' });
      }

      if (!JWT_SECRET) {
            return res.status(500).json({ message: 'مشكلة في الإعدادات: JWT_SECRET مش متوفر' });
      }

      jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                  return res.status(403).json({ message: 'التوكن غير صالح أو منتهي' });
            }

            req.user = user;
            next();
      });
}

function requireRole(...allowedRoles) {
      return (req, res, next) => {
            if (!req.user || !allowedRoles.includes(req.user.role)) {
                  return res.status(403).json({ message: 'غير مسموح' });
            }
            next();
      };
}

function requireSelfOrRole(...allowedRoles) {
      return (req, res, next) => {
            const userIdFromToken = req.user && req.user.userId;
            const idParam = req.params && (req.params.id || req.params.userId);
            const isSelf = userIdFromToken && idParam && String(userIdFromToken) === String(idParam);
            const hasRole = req.user && allowedRoles.includes(req.user.role);
            if (!isSelf && !hasRole) {
                  return res.status(403).json({ message: 'غير مسموح' });
            }
            next();
      };
}

module.exports = { authenticateToken, requireRole, requireSelfOrRole };
