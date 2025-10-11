const pool = require("../db");

const getResultsByNationalId = async (req, res) => {
      const { nationalId } = req.params;

      try {
            if (!nationalId) {
                  return res.status(400).json({ message: "الرقم القومي مطلوب" });
            }

            const query = `
      SELECT 
        r.*,
        u."fullName" AS staff_name,
        u."phoneNumber" AS staff_phone,
        u."email" AS staff_email
      FROM result r
      LEFT JOIN users u ON r."userId" = u.id
      WHERE r."nationalId" = $1
      ORDER BY r."createdAt" DESC;
    `;

            const { rows } = await pool.query(query, [nationalId]);

            if (rows.length === 0) {
                  return res.status(404).json({ message: "لا توجد نتائج لهذا الرقم القومي" });
            }

            res.json({ message: "success", data: rows });
      } catch (error) {
            console.error("❌ Error in getResultsByNationalId:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

module.exports = { getResultsByNationalId };
