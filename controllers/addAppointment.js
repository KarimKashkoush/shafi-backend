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
            const isRevisit = req.body.isRevisit || false;


            // الحقول الجديدة
            const birthDate = req.body.birthDate || null;
            const hasChronicDisease = req.body.hasChronicDisease || false;
            const chronicDiseaseDetails = req.body.chronicDiseaseDetails || null;

            // الحقل الجديد (اختياري)
            const price = req.body.price || null;

            const normalizedDateTime = dateTime ? toUtcIso(dateTime) : null;
            const normalizedBirthDate = birthDate ? toUtcIso(birthDate, { dateOnly: true }) : null;

            if (dateTime && !normalizedDateTime) {
                  return res.status(400).json({ message: "تاريخ / وقت الحجز غير صالح" });
            }

            if (birthDate && !normalizedBirthDate) {
                  return res.status(400).json({ message: "تاريخ الميلاد غير صالح" });
            }

            // جلب medicalCenterId مباشرة من جدول users
            let medicalCenterId = null;
            if (userId) {
                  const userQuery = await pool.query(
                        'SELECT "medicalCenterId" FROM users WHERE id = $1',
                        [userId]
                  );
                  if (userQuery.rows.length > 0) {
                        medicalCenterId = userQuery.rows[0].medicalCenterId;
                  }
            }

            const query = `
            INSERT INTO appointments 
            ("userId", "caseName", "phone", "nationalId", "testName", "doctorId",
 "medicalCenterId", "dateTime", "birthDate", "hasChronicDisease",
 "chronicDiseaseDetails", "price", "isRevisit")

            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *;
            `;
            const values = [
                  userId,
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  doctorId,
                  medicalCenterId,
                  normalizedDateTime,
                  normalizedBirthDate,
                  hasChronicDisease,
                  chronicDiseaseDetails,
                  price,
                  isRevisit
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
            const { userId, report, nextAction, sessionCost, medicalCenterId } = req.body;

            if (!userId) return res.status(400).json({ message: "userId (الدكتور) مطلوب" });

            // هات بيانات الحجز
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
      INSERT INTO result ("appointmentId", "doctorId", "caseName", "phone", "nationalId", "testName", "files", "report", "nextAction", "sessionCost", "medicalCenterId")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

            const values = [
                  id,
                  userId,           // الدكتور
                  caseName,
                  phone,
                  nationalId,       // المريض عن طريق الرقم القومي
                  testName,
                  JSON.stringify(uploadedFiles),
                  report || null,
                  nextAction || null,
                  sessionCost || null,
                  medicalCenterId || null  // هنا ضفنا medicalCenterId
            ];

            const resultInsert = await pool.query(query, values);
            const newResult = resultInsert.rows[0];

            res.status(201).json({ message: "success", data: newResult });

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
            a.price,
            a."isRevisit",

            r.files AS "resultFiles",
            r."createdAt" AS "resultCreatedAt",
            r."sessionCost" AS "sessionCost",
            r."report" AS "resultReports",


            d.id AS "doctorId",
            u.id AS "doctorUserId"
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

// controllers/addAppointment.js
const getAppointmentsForDashboard = async (req, res) => {
      try {
            const { id } = req.params; // ده هيبقى userId

            const query = `
SELECT 
    a.id,
    a."caseName",
    a."dateTime",
    a.price,
    r."sessionCost",
    r."doctorId",
    u."fullName" AS "doctorName",
    r."report" AS "report",
    r."createdAt" AS "createdAt"
FROM appointments a
LEFT JOIN result r ON a.id = r."appointmentId"
LEFT JOIN users u ON r."doctorId" = u.id
WHERE a."userId" = $1
ORDER BY a."createdAt" DESC;

      `;

            const result = await pool.query(query, [id]);
            res.json({ message: "success", data: result.rows });
      } catch (error) {
            console.error("❌ Error in getAppointmentsForDashboard:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};



// ✅ 4. حذف حجز بالـ id
const deleteAppointment = async (req, res) => {
      try {
            const { id } = req.params;

            // أولاً نمسح أي نتائج مرتبطة بالحجز
            await pool.query(`DELETE FROM result WHERE "appointmentId" = $1`, [id]);

            // نمسح أي مدفوعات مرتبطة بالحجز
            await pool.query(`DELETE FROM payments WHERE "appointmentId" = $1`, [id]);

            // بعدين نمسح الحجز نفسه
            const query = `DELETE FROM appointments WHERE id = $1 RETURNING *`;
            const result = await pool.query(query, [id]);

            if (result.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({
                  message: "تم حذف الحجز بنجاح مع النتائج والمدفوعات المرتبطة",
                  data: result.rows[0]
            });
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
      LEFT JOIN payments p ON a.id = p."appointmentId"
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
      getAppointmentById,
      getAppointmentsForDashboard
};
