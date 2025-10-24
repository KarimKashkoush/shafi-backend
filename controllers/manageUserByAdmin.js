import bcrypt from "bcryptjs";
import db from "../db.js";

// ✅ إضافة مستخدم بواسطة الأدمن
async function addUserByAdmin(req, res) {
      try {
            const { fullName, email, phoneNumber, userType, gender, specialty } = req.body;

            const hashedPassword = await bcrypt.hash("Pass123@", 10);

            const result = await db.query(
                  `INSERT INTO users ("fullName", email, "phoneNumber", password, role, gender, status, "lastUpdated")
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
             RETURNING *`,
                  [fullName, email, phoneNumber, hashedPassword, userType, gender]
            );

            const user = result.rows[0];

            // لو المستخدم دكتور، احفظ تخصصه في جدول doctors
            if (userType === "doctor") {
                  await db.query(
                        `INSERT INTO doctors ("userId", specialty) VALUES ($1, $2)`,
                        [user.id, specialty]
                  );
            }

            res.status(201).json({ message: "تم إنشاء المستخدم بنجاح", user });
      } catch (err) {
            console.error(err);

            // التعامل مع خطأ تكرار البريد أو الهاتف
            if (err.code === "400") {
                  if (err.constraint === "users_email_key") {
                        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل من قبل مستخدم آخر" });
                  }
            }

            res.status(500).json({ message: "حدث خطأ أثناء إنشاء المستخدم" });
      }
}


// ✅ جلب جميع المستخدمين
async function getAllUsersByAdmin(req, res) {
      try {
            const result = await db.query(
                  `SELECT id, "fullName", email, "phoneNumber", role, gender, status, "lastUpdated"
       FROM users ORDER BY "lastUpdated" DESC`
            );
            res.json({ users: result.rows });
      } catch (err) {
            console.error(err);
            res.status(500).json({ message: "حدث خطأ أثناء جلب المستخدمين" });
      }
}

// ✅ جلب مستخدم محدد بالـ ID
async function getUserById(req, res) {
      try {
            const { id } = req.params;

            const result = await db.query(
                  `SELECT id, "fullName", email, "phoneNumber", role, gender, status, "lastUpdated"
       FROM users WHERE id = $1`,
                  [id]
            );

            if (result.rows.length === 0) {
                  return res.status(404).json({ message: "المستخدم غير موجود" });
            }

            const user = result.rows[0];

            // لو المستخدم دكتور، هات بياناته الإضافية
            if (user.role === "doctor") {
                  const doctorData = await db.query(
                        `SELECT specialty FROM doctors WHERE "userId" = $1`,
                        [user.id]
                  );
                  user.specialty = doctorData.rows[0]?.specialty || null;
            }

            res.json({ user });
      } catch (err) {
            console.error(err);
            res.status(500).json({ message: "حدث خطأ أثناء جلب بيانات المستخدم" });
      }
}

// ✅ تجميد أو تفعيل المستخدم
async function toggleUserStatus(req, res) {
      try {
            const { id } = req.params;

            const result = await db.query(
                  `UPDATE users
       SET status = NOT status, "lastUpdated" = NOW()
       WHERE id = $1
       RETURNING id, "fullName", status`,
                  [id]
            );

            if (result.rows.length === 0) {
                  return res.status(404).json({ message: "المستخدم غير موجود" });
            }

            const user = result.rows[0];
            const statusMsg = user.status ? "تم تفعيل المستخدم" : "تم تجميد المستخدم";

            res.json({ message: statusMsg, user });
      } catch (err) {
            console.error(err);
            res.status(500).json({ message: "حدث خطأ أثناء تعديل حالة المستخدم" });
      }
}

export { addUserByAdmin, getAllUsersByAdmin, getUserById, toggleUserStatus };
