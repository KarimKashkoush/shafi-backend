const pool = require("../db");
const bcrypt = require("bcrypt");

// 🟢 إضافة موظف استقبال أو دكتور جديد
async function addReceptionist(req, res) {
      const medicalCenterId = req.user.userId; // الشخص اللي بيضيف → Medical Center
      const userRole = req.user.role;

      const { fullName, email, phoneNumber, password, role, specialty } = req.body;

      if (!fullName || !email || !phoneNumber || !password || !role)
            return res.status(400).json({ message: "كل الحقول مطلوبة" });

      try {
            // التحقق من التكرار
            const existing = await pool.query(
                  `SELECT * FROM users WHERE email = $1 OR "phoneNumber" = $2`,
                  [email, phoneNumber]
            );
            if (existing.rows.length > 0)
                  return res.status(400).json({ message: "الحساب موجود بالفعل" });

            const hashedPassword = await bcrypt.hash(password, 10);
            const finalRole = role === "doctor" ? "doctor" : "receptionist";

            // إدخال المستخدم في جدول users مع status=true
            const userResult = await pool.query(
                  `INSERT INTO users ("fullName", email, "phoneNumber", password, role, "medicalCenterId", status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id, "fullName", email, "phoneNumber", role, "medicalCenterId", status`,
                  [fullName, email, phoneNumber, hashedPassword, finalRole, medicalCenterId, true]
            );

            const userId = userResult.rows[0].id;

            // إدخال بيانات إضافية حسب الدور بدون status
            if (role === "receptionist") {
                  await pool.query(
                        `INSERT INTO receptionists ("receptionistId", "medicalCenterId", "creatorRole")
                         VALUES ($1, $2, $3)`,
                        [userId, medicalCenterId, userRole]
                  );
            }

            if (role === "doctor") {
                  if (!specialty)
                        return res.status(400).json({ message: "التخصص مطلوب للدكتور" });

                  await pool.query(
                        `INSERT INTO doctors ("userId", specialty, "medicalCenterId")
                         VALUES ($1, $2, $3)`,
                        [userId, specialty, medicalCenterId]
                  );
            }

            res.status(201).json({
                  message: "تم إضافة الموظف بنجاح",
                  data: userResult.rows[0],
            });

      } catch (err) {
            console.error("DB error in addStaff:", err);
            res.status(500).json({ message: "حدث خطأ أثناء الإضافة", error: err.message });
      }
}


// 🟡 عرض جميع الموظفين بناءً على medicalCenterId
async function getReceptionists(req, res) {
      const medicalCenterId = req.user.userId;

      try {
            // جلب موظفي الاستقبال
            const receptionistsQuery = `
                  SELECT 
                        u.id, 
                        u."fullName", 
                        u.email, 
                        u."phoneNumber", 
                        u.status,  
                        u."medicalCenterId", 
                        'receptionist' AS role
                  FROM users u
                  JOIN receptionists r ON u.id = r."receptionistId"
                  WHERE r."medicalCenterId" = $1
            `;
            const receptionists = (await pool.query(receptionistsQuery, [medicalCenterId])).rows;

            // جلب الدكاترة مع medicalCenterId
            const doctorsQuery = `
                  SELECT 
                        u.id, 
                        u."fullName", 
                        u.email, 
                        u."phoneNumber", 
                        d.specialty, 
                        u.status, 
                        u."medicalCenterId",
                        'doctor' AS role
                  FROM users u
                  JOIN doctors d ON u.id = d."userId"
                  WHERE d."medicalCenterId" = $1
            `;
            const doctors = (await pool.query(doctorsQuery, [medicalCenterId])).rows;

            // دمج النتائج
            const allStaff = [...receptionists, ...doctors];

            res.status(200).json({ data: allStaff });

      } catch (err) {
            console.error("DB error in getStaff:", err);
            res.status(500).json({ message: "حدث خطأ أثناء جلب البيانات", error: err.message });
      }
}

// 🟠 تحديث حالة الحساب (نشط / مجمد)
async function updateReceptionistStatus(req, res) {
      const { id } = req.params;
      const { status } = req.body;

      if (!["true", "false"].includes(status))
            return res.status(400).json({ message: "الحالة يجب أن تكون true أو false" });

      try {
            // تحديث المستخدم فقط
            await pool.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);

            res.status(200).json({
                  message: `تم ${status === "true" ? "تفعيل" : "تجميد"} الحساب بنجاح`,
            });
      } catch (err) {
            console.error("DB error in updateStaffStatus:", err);
            res.status(500).json({ message: "حدث خطأ أثناء تحديث الحالة", error: err.message });
      }
}

// 🔴 حذف موظف
async function deleteReceptionist(req, res) {
      const { id } = req.params;

      try {
            await pool.query(`DELETE FROM receptionists WHERE "receptionistId" = $1`, [id]);
            await pool.query(`DELETE FROM doctors WHERE "userId" = $1`, [id]);
            await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

            res.status(200).json({ message: "تم حذف الموظف بنجاح" });
      } catch (err) {
            console.error("DB error in deleteStaff:", err);
            res.status(500).json({ message: "حدث خطأ أثناء الحذف", error: err.message });
      }
}

module.exports = { addReceptionist, getReceptionists, updateReceptionistStatus, deleteReceptionist, };