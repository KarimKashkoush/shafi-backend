const pool = require('../db');
const { uploadFileToS3 } = require("../middleware/s3");

const staffAddResult = async (req, res) => {
      const client = await pool.connect();
      try {
            const { appointmentId, userId } = req.body;

            if (!appointmentId) {
                  return res.status(400).json({ message: "appointmentId مطلوب" });
            }

            // رفع الملفات إلى S3
            let uploadedFiles = [];
            if (req.files && req.files.length > 0) {
                  for (const file of req.files) {
                        const fileUrl = await uploadFileToS3(file);
                        uploadedFiles.push(fileUrl);
                  }
            }

            // إدخال النتيجة وربطها بالحجز
            const query = `
      INSERT INTO result ("appointmentId", "userId", "files", "createdAt")
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

            const values = [
                  appointmentId,
                  userId,
                  JSON.stringify(uploadedFiles),
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
