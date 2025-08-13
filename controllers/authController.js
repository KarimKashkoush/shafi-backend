const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

function generateId(length = 30) {
      return crypto.randomBytes(Math.ceil(length / 2)) // تولد بايتات عشوائية
            .toString('hex') // تحولها لـ hex string
            .slice(0, length); // تاخد اول 30 حرف
}

async function registerUser(req, res) {
      const { firstName, fullName, email, phoneNumber, password, pin, role, gender } = req.body;

      try {
            // تحقق من وجود مستخدم بنفس البريد أو رقم الهاتف (لو القيم موجودة)
            const existingUser = await pool.query(
                  'SELECT * FROM "Users" WHERE email = $1 OR phone_number = $2',
                  [email || null, phoneNumber || null]
            );

            if (existingUser.rows.length > 0) {
                  return res.status(400).json({ message: 'الحساب موجود بالفعل' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const id = generateId(30);

            const newUser = await pool.query(
                  `INSERT INTO "Users" (id, first_name, full_name, email, phone_number, password, pin, role, gender)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   RETURNING id, first_name, full_name, email, phone_number, role, gender`,
                  [id, firstName, fullName, email, phoneNumber, hashedPassword, pin, role, gender]
            );

            res.status(201).json({ message: 'success', user: newUser.rows[0] });
      } catch (err) {
            console.error("Database error:", err);
            res.status(500).json({ message: 'error', error: err.message });
      }
}


// Get All Users

async function getAllUsers(req, res) {
      try {
            const result = await pool.query('SELECT * FROM "Users"'); // أو 'users' حسب اسم الجدول عندك
            res.status(200).json({
                  message: "success",
                  users: result.rows
            });
      } catch (error) {
            console.error("Database error:", error);
            res.status(500).json({ message: "حدث خطأ في السيرفر", error: error.message });
      }
}


// Get one User
async function getUser(req, res) {
      const { id } = req.params;
      try {
            const userResult = await pool.query('SELECT * FROM "Users" WHERE id = $1', [id]);
            if (userResult.rows.length === 0) {
                  return res.status(404).json({ message: 'المريض غير موجود' });
            }
            const user = userResult.rows[0];

            const reportsResult = await pool.query('SELECT * FROM "Reports" WHERE "userId" = $1 ORDER BY "createdAt" DESC', [id]);
            const reports = reportsResult.rows;

            res.json({ user, reports });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'خطأ في السيرفر' });
      }
}

// Update User
async function updateUser(req, res) {
      const { id } = req.params;
      const { firstName, fullName, phoneNumber, email, gender, blood, emergencyNumber, address, birthDate } = req.body;

      try {
            // تحديث بيانات المستخدم
            const updateResult = await pool.query(
                  `UPDATE "Users" SET
         first_name = $1,
         full_name = $2,
         phone_number = $3,
         email = $4,
         gender = $5,
         blood = $6,
         emergency_number = $7,
         address = $8,
         birth_date = $9
       WHERE id = $10
       RETURNING id, first_name, full_name, phone_number, email, gender, blood, emergency_number, address, birth_date`,
                  [firstName, fullName, phoneNumber, email, gender, blood, emergencyNumber, address, birthDate, id]
            );

            if (updateResult.rows.length === 0) {
                  return res.status(404).json({ message: "المستخدم غير موجود" });
            }

            res.json({ message: "success", user: updateResult.rows[0] });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: "خطأ في السيرفر" });
      }
}


module.exports = { registerUser, getAllUsers, getUser, updateUser };
