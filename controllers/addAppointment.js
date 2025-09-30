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

            let uploadedFiles = [];
            if (req.files && req.files.length > 0) {
                  for (const file of req.files) {
                        const fileUrl = await uploadFileToS3(file);
                        uploadedFiles.push(fileUrl);
                  }
            }

            const query = `
            INSERT INTO result ("appointmentId", "userId", "files")
            VALUES ($1, $2, $3)
            RETURNING *`;

            const values = [id, userId, uploadedFiles];
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

module.exports = {
      addAppointment,
      addResultToAppointment,
      getAppointmentsWithResults
};
