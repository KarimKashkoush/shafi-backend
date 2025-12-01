const pool = require('../db');
const { uploadFileToS3 } = require("../middleware/s3");
const { toUtcIso } = require("../utils/datetime");

const addAppointment = async (req, res) => {
      try {
            const userId = req.body.userId || null;
            const caseName = req.body.caseName || null;
            const phone = req.body.phone || null;
            const nationalId = req.body.nationalId || null;
            const testName = req.body.testName || null;
            const doctorId = req.body.doctorId || null;
            const dateTime = req.body.dateTime || null;

            // الحقول الجديدة
            const birthDate = req.body.birthDate || null;
            const hasChronicDisease = req.body.hasChronicDisease || false;
            const chronicDiseaseDetails = req.body.chronicDiseaseDetails || null;

            // 👈 الحقل الجديد (اختياري)
            const price = req.body.price || null;

            const normalizedDateTime = dateTime ? toUtcIso(dateTime) : null;
            const normalizedBirthDate = birthDate ? toUtcIso(birthDate, { dateOnly: true }) : null;

            if (dateTime && !normalizedDateTime) {
                  return res.status(400).json({ message: "تاريخ / وقت الحجز غير صالح" });
            }

            if (birthDate && !normalizedBirthDate) {
                  return res.status(400).json({ message: "تاريخ الميلاد غير صالح" });
            }

            // جلب centerId لو userId موجود
            let centerId = null;
            if (userId) {
                  const receptionistQuery = await pool.query(
                        'SELECT "creatorId" FROM receptionists WHERE "receptionistId" = $1',
                        [userId]
                  );
                  if (receptionistQuery.rows.length > 0) {
                        centerId = receptionistQuery.rows[0].creatorId;
                  }
            }

            const query = `
            INSERT INTO appointments 
            ("userId", "caseName", "phone", "nationalId", "testName", "doctorId", "centerId", "dateTime",
            "birthDate", "hasChronicDisease", "chronicDiseaseDetails", "price")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
      `;

            const values = [
                  userId,
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  doctorId,
                  centerId,
                  normalizedDateTime,
                  normalizedBirthDate,
                  hasChronicDisease,
                  chronicDiseaseDetails,
                  price
            ];

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
            const { userId, report, nextAction, sessionCost } = req.body;

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
            INSERT INTO result ("appointmentId", "userId", "caseName", "phone", "nationalId", "testName", "files", "report", "nextAction", "sessionCost")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            `;

            const values = [
                  id,
                  userId,
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  JSON.stringify(uploadedFiles),
                  report || null,
                  nextAction || null,
                  sessionCost || null
            ];

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
      SELECT 
  a.id,
  a."userId",
  a."caseName",
  a."phone",
  a."nationalId",
  a."testName",
  a."createdAt",
  a."dateTime",
  a."birthDate",
  a."hasChronicDisease",
  a."chronicDiseaseDetails",

  r.files AS "resultFiles",
  r."createdAt" AS "resultCreatedAt",
  r."sessionCost" AS "sessionCost",


  d.id AS "doctorId",
  u."fullName" AS "doctorName",
  u."phoneNumber" AS "doctorPhone",
  d.specialty AS "doctorSpecialty",

  a."centerId"  -- ✅ هنا جلبنا centerId مباشرة من appointments

FROM appointments a
LEFT JOIN result r ON a.id = r."appointmentId"
LEFT JOIN doctors d ON a."doctorId" = d.id
LEFT JOIN users u ON d."userId" = u.id

ORDER BY a."createdAt" DESC;
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

const getAppointmentById = async (req, res) => {
      try {
            const { id } = req.params;

            const query = `
      SELECT 
        a.id,
        a."userId",
        a."caseName",
        a."phone",
        a."nationalId",
        a."testName",
        a."createdAt",
        r.files AS "resultFiles",
        r."createdAt" AS "resultCreatedAt",
        u."fullName" AS "doctorName",
        u."phoneNumber" AS "doctorPhone",
        d.specialty AS "doctorSpecialty"
      FROM appointments a
      LEFT JOIN result r ON a.id = r."appointmentId"
      LEFT JOIN doctors d ON a."doctorId" = d.id
      LEFT JOIN users u ON d."userId" = u.id
      WHERE a.id = $1
      LIMIT 1
    `;

            const result = await pool.query(query, [id]);

            if (result.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in getAppointmentById:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

module.exports = {
      addAppointment,
      addResultToAppointment,
      getAppointmentsWithResults,
      deleteAppointment,
      updateNationalId,
      getAppointmentById
};
