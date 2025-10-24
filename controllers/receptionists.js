const pool = require("../db");
const bcrypt = require("bcrypt");

// 🟢 إضافة موظف استقبال جديد
async function addReceptionist(req, res) {
      const creatorId = req.user.userId;
      const creatorRole = req.user.role; 
      const { fullName, email, phoneNumber, password } = req.body;

      if (!fullName || !email || !phoneNumber || !password)
            return res.status(400).json({ message: "كل الحقول مطلوبة" });

      try {
            // تحقق من تكرار الإيميل أو الهاتف
            const existing = await pool.query(
                  `SELECT * FROM users WHERE email = $1 OR "phoneNumber" = $2`,
                  [email, phoneNumber]
            );

            if (existing.rows.length > 0)
                  return res.status(400).json({ message: "الحساب موجود بالفعل" });

            const hashedPassword = await bcrypt.hash(password, 10);

            // تحديد نوع موظف الاستقبال حسب المُنشئ
            const receptionRoleMap = {
                  doctor: "clinic_reception",
                  lab: "lab_reception",
                  radiology: "radiology_reception",
            };
            const receptionRole = receptionRoleMap[creatorRole];

            if (!receptionRole)
                  return res.status(400).json({ message: "نوع المستخدم غير صالح لإنشاء استقبال" });

            // 1️⃣ إدخاله في جدول users
            const userResult = await pool.query(
                  `INSERT INTO users ("fullName", email, "phoneNumber", password, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, "fullName", email, "phoneNumber", role, status`,
                  [fullName, email, phoneNumber, hashedPassword, receptionRole, "true"]
            );

            const receptionistId = userResult.rows[0].id;

            // 2️⃣ ربطه بالمنشئ
            await pool.query(
                  `INSERT INTO receptionists ("receptionistId", "creatorId", "creatorRole")
       VALUES ($1, $2, $3)`,
                  [receptionistId, creatorId, creatorRole]
            );

            res.status(201).json({
                  message: "تم إضافة موظف الاستقبال وربطه بنجاح",
                  data: userResult.rows[0],
            });
      } catch (err) {
            console.error("DB error in addReceptionist:", err);
            res.status(500).json({ message: "حدث خطأ أثناء الإضافة", error: err.message });
      }
}

// 🟡 عرض جميع موظفي الاستقبال المرتبطين بالمستخدم الحالي
async function getReceptionists(req, res) {
      const creatorId = req.user.userId;

      try {
            const query = `
      SELECT u.id, u."fullName", u.email, u."phoneNumber", r.status, r."creatorRole"
      FROM users u
      JOIN receptionists r ON u.id = r."receptionistId"
      WHERE r."creatorId" = $1
    `;
            const { rows } = await pool.query(query, [creatorId]);
            res.status(200).json({ data: rows });
      } catch (err) {
            console.error("DB error in getReceptionists:", err);
            res.status(500).json({ message: "حدث خطأ أثناء جلب البيانات", error: err.message });
      }
}

// 🟠 تحديث حالة الحساب
async function updateReceptionistStatus(req, res) {
      const { id } = req.params;
      const { status } = req.body;

      if (!["active", "frozen"].includes(status))
            return res.status(400).json({ message: "الحالة يجب أن تكون active أو frozen" });

      try {
            await pool.query(
                  `UPDATE receptionists SET status = $1 WHERE "receptionistId" = $2`,
                  [status, id]
            );
            await pool.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);

            res.status(200).json({
                  message: `تم ${status === "active" ? "تفعيل" : "تجميد"} الحساب بنجاح`,
            });
      } catch (err) {
            console.error("DB error in updateReceptionistStatus:", err);
            res.status(500).json({ message: "حدث خطأ أثناء تحديث الحالة", error: err.message });
      }
}

// 🔴 حذف موظف استقبال
async function deleteReceptionist(req, res) {
      const { id } = req.params;
      try {
            await pool.query(`DELETE FROM receptionists WHERE "receptionistId" = $1`, [id]);
            await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
            res.status(200).json({ message: "تم حذف موظف الاستقبال بنجاح" });
      } catch (err) {
            console.error("DB error in deleteReceptionist:", err);
            res.status(500).json({ message: "حدث خطأ أثناء الحذف", error: err.message });
      }
}

module.exports = {
      addReceptionist,
      getReceptionists,
      updateReceptionistStatus,
      deleteReceptionist,
};
