const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
async function login(req, res) {
      const { email, phoneNumber, password } = req.body;
      const loginValue = email || phoneNumber;

      if (!loginValue || !password)
            return res.status(400).json({ message: "يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور" });

      try {
            const userQuery = await pool.query(
                  `SELECT * FROM users WHERE email = $1 OR "phoneNumber" = $1`,
                  [loginValue]
            );

            if (userQuery.rows.length === 0)
                  return res.status(400).json({ message: 'المستخدم غير موجود' });

            const user = userQuery.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch)
                  return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });

            const token = jwt.sign(
                  { userId: user.id, role: user.role },
                  JWT_SECRET,
                  { expiresIn: '7d' }
            );

            res.status(200).json({
                  message: 'success',
                  token,
                  user: {
                        id: user.id,
                        firstName: user.firstName,
                        fullName: user.fullName,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        role: user.role,
                        gender: user.gender,
                        medicalCenterId: user.medicalCenterId,
                        specialty: user.specialty || null
                  }
            });

      } catch (err) {
            console.error("Database error:", err);
            res.status(500).json({ message: 'error', error: err.message });
      }
}


module.exports = { login };
