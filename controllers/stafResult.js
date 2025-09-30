const pool = require('../db');
const { uploadFileToS3 } = require("../middleware/s3");

const staffAddResult = async (req, res) => {
      const client = await pool.connect();
      try {
            const { caseName, phone, nationalId, testName, userId, createdAt } = req.body;

            let uploadedFiles = [];
            if (req.files && req.files.length > 0) {
                  for (const file of req.files) {
                        const fileUrl = await uploadFileToS3(file);
                        uploadedFiles.push(fileUrl);
                  }
            }

            const query = `
      INSERT INTO result ("userId", "caseName", "phone", "nationalId", "testName", "files", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`;
            const values = [
                  userId,
                  caseName,
                  phone,
                  nationalId || null,
                  testName,
                  uploadedFiles,
                  createdAt || new Date().toISOString(),
            ]; const pool = require('../db');

            const staffAddResult = async (req, res) => {
                  const client = await pool.connect();
                  try {
                        const { caseName, phone, nationalId, testName, userId, createdAt } = req.body;

                        // 1. رفع الملفات إلى S3
                        let uploadedFiles = [];
                        if (req.files && req.files.length > 0) {
                              for (const file of req.files) {
                                    const fileUrl = await uploadFileToS3(file);
                                    uploadedFiles.push(fileUrl);
                              }
                        }

                        // 2. تخزين البيانات في قاعدة البيانات (camelCase)
                        const query = `
      INSERT INTO result ("userId", "caseName", "phone", "nationalId", "testName", "files", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`;
                        const values = [
                              userId,
                              caseName,
                              phone,
                              nationalId || null,
                              testName,
                              JSON.stringify(uploadedFiles),
                              createdAt || new Date().toISOString(),
                        ];

                        const result = await client.query(query, values);

                        res.json({
                              message: "success",
                              data: result.rows[0],
                        });
                  } catch (error) {
                        console.error("❌ Error in addResult controller:", error);
                        res.status(500).json({ message: "error", error: error.message });
                  } finally {
                        client.release();
                  }
            };

            module.exports = {
                  staffAddResult
            };


            const result = await client.query(query, values);

            res.json({
                  message: "success",
                  data: result.rows[0],
            });
      } catch (error) {
            console.error("❌ Error in addResult controller:", error);
            res.status(500).json({ message: "error", error: error.message });
      } finally {
            client.release();
      }
};

module.exports = {
      staffAddResult
};
