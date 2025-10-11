const pool = require('../db');
const { uploadFileToS3 } = require("../middleware/s3");

const staffAddResult = async (req, res) => {
      const client = await pool.connect();
      try {
            const { appointmentId, userId, caseName, phone, nationalId, testName } = req.body;

            // التحقق من المدخلات الأساسية
            if (!userId) {
                  return res.status(400).json({ message: "userId مطلوب" });
            }

            // رفع الملفات إلى S3
            let uploadedFiles = [];
            if (req.files && req.files.length > 0) {
                  for (const file of req.files) {
                        const fileUrl = await uploadFileToS3(file);
                        uploadedFiles.push(fileUrl);
                  }
            }

            // ✅ لو جاية من صفحة "الحالات" ومعاها appointmentId
            if (appointmentId) {
                  const query = `
                        INSERT INTO result ("appointmentId", "userId", "files", "createdAt")
                        VALUES ($1, $2, $3, $4)
                        RETURNING *;
                  `;
                  const values = [appointmentId, userId, JSON.stringify(uploadedFiles), new Date().toISOString()];
                  const result = await client.query(query, values);
                  return res.json({ message: "success", data: result.rows[0] });
            }

            // ✅ لو جاية من صفحة "إضافة نتيجة جديدة" StafAddResult (من غير appointment)
            const query = `
                  INSERT INTO result ("userId", "caseName", "phone", "nationalId", "testName", "files", "createdAt")
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                  RETURNING *;
            `;
            const values = [
                  userId,
                  caseName || null,
                  phone || null,
                  nationalId || null,
                  testName || null,
                  uploadedFiles,
                  new Date().toISOString()
            ];

            const result = await client.query(query, values);

            res.json({ message: "success", data: result.rows[0] });

      } catch (error) {
            console.error("❌ Error in staffAddResult:", error);
            res.status(500).json({ message: "error", error: error.message });
      } finally {
            client.release();
      }
};

module.exports = { staffAddResult };
