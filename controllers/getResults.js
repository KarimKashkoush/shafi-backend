const pool = require("../db");

const getAllResults = async (req, res) => {
      const client = await pool.connect();
      try {
            // ممكن نضيف فلترة مثلاً حسب userId لو حبيت لاحقًا
            const query = `
      SELECT 
        r.*,
        u."fullName" AS patient_name,
        u."phoneNumber" AS patient_phone,
        u."email" AS patient_email
      FROM result r
      LEFT JOIN users u ON r."userId" = u.id
      ORDER BY r."createdAt" DESC;
    `;

            const result = await client.query(query);

            res.json({
                  message: "success",
                  data: result.rows,
            });
      } catch (error) {
            console.error("❌ Error in getAllResults:", error);
            res.status(500).json({
                  message: "error",
                  error: error.message,
            });
      } finally {
            client.release();
      }
};

module.exports = { getAllResults };
