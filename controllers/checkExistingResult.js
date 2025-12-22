const pool = require("../db"); // ✅ استيراد الاتصال بقاعدة البيانات (نفس اللي بتستخدمه في باقي الكنترولرز)

async function checkExistingResult(req, res) {
      try {
            const { phone, nationalId, testName } = req.query;

            if (!phone || !testName) {
                  return res.status(400).json({ error: "Phone و testName مطلوبين" });
            }

            let query = `
      SELECT * FROM reports 
      WHERE test_name = $1 
      AND (phone = $2 OR national_id = $3)
      LIMIT 1
      `;
            const values = [testName, phone, nationalId || null];

            const result = await pool.query(query, values);

            if (result.rows.length > 0) {
                  return res.json({ exists: true });
            } else {
                  return res.json({ exists: false });
            }
      } catch (err) {
            console.error("❌ Error in checkExistingResult:", err);
            res.status(500).json({ error: "Server error" });
      }
}

module.exports = { checkExistingResult };
