const pool = require('../db');
const { uploadFileToS3 } = require("../middleware/s3");

// ✅ 1. إضافة حجز جديد (بدون نتيجة)
const addAppointment = async (req, res) => {
      try {
            const { caseName, phone, nationalId, testName, userId } = req.body;

            const query = `
            INSERT INTO appointments ("userId", "caseName", "phone", "nationalId", "testName")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;

            const values = [userId, caseName, phone, nationalId || null, testName];
            const result = await pool.query(query, values);

            res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in addAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

// ✅ 2. إضافة نتيجة لحجز موجود (upload files → S3 → save in result)
const addResultToAppointment = async (req, res) => {
      try {
            const { id } = req.params; // appointmentId
            const { userId } = req.body;

            // هات بيانات الحجز الأول
            const apptRes = await pool.query(
                  `SELECT "caseName", "phone", "nationalId", "testName"
       FROM appointments WHERE id = $1`,
                  [id]
            );

            if (apptRes.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز مش موجود" });
            }

            const { caseName, phone, nationalId, testName } = apptRes.rows[0];

            // رفع الملفات
            let uploadedFiles = [];
            if (req.files && req.files.length > 0) {
                  for (const file of req.files) {
                        const fileUrl = await uploadFileToS3(file);
                        uploadedFiles.push(fileUrl);
                  }
            }

            // إدخال النتيجة مرتبطة بالحجز
            const query = `
      INSERT INTO result ("appointmentId", "userId", "caseName", "phone", "nationalId", "testName", "files")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`;

            const values = [id, userId, caseName, phone, nationalId, testName, uploadedFiles];
            const resultInsert = await pool.query(query, values);

            res.json({ message: "success", data: resultInsert.rows[0] });
      } catch (error) {
            console.error("❌ Error in addResultToAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};


// ✅ 3. عرض كل الحجوزات مع النتائج
const getAppointmentsWithResults = async (req, res) => {
      try {
            const query = `
    SELECT a.*, r.files AS "resultFiles", r."createdAt" AS "resultCreatedAt"
    FROM appointments a
    LEFT JOIN result r ON a.id = r."appointmentId"
    ORDER BY a."createdAt" DESC
`;

            const result = await pool.query(query);

            res.json({ message: "success", data: result.rows });
      } catch (error) {
            console.error("❌ Error in getAppointmentsWithResults:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

// ✅ 4. حذف حجز بالـ id
const deleteAppointment = async (req, res) => {
      try {
            const { id } = req.params;

            // الأول نمسح أي نتيجة مرتبطة بالحجز
            await pool.query(`DELETE FROM result WHERE "appointmentId" = $1`, [id]);

            // بعدين نمسح الحجز نفسه
            const query = `DELETE FROM appointments WHERE id = $1 RETURNING *`;
            const result = await pool.query(query, [id]);

            if (result.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({ message: "تم حذف الحجز بنجاح", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in deleteAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

// ✅ 5. تعديل أو إضافة الرقم القومي لحجز
const updateNationalId = async (req, res) => {
      try {
            const { id } = req.params; // appointmentId
            const { nationalId } = req.body;

            if (!nationalId) {
                  return res.status(400).json({ message: "الرقم القومي مطلوب" });
            }

            const query = `
            UPDATE appointments
            SET "nationalId" = $1
            WHERE id = $2
            RETURNING *;
        `;

            const values = [nationalId, id];
            const result = await pool.query(query, values);

            if (result.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in updateNationalId:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};



module.exports = {
      addAppointment,
      addResultToAppointment,
      getAppointmentsWithResults,
      deleteAppointment,
      updateNationalId
};
