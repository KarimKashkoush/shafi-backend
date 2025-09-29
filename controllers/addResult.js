const pool = require('../db');
const { uploadFileToS3 } = require('../middleware/s3');

async function addResult(req, res) {
      const reportId = parseInt(req.params.reportId || req.body.reportId, 10);
      const { type, index } = req.body;
      const userId = req.body.userId; // 👈 ناخد userId من body

      if (!reportId) return res.status(400).json({ message: "reportId مطلوب" });
      if (!type || !['radiology', 'labTests'].includes(type)) {
            return res.status(400).json({ message: 'type مطلوب ويكون "radiology" أو "labTests"' });
      }

      const idx = parseInt(index, 10);
      if (Number.isNaN(idx)) return res.status(400).json({ message: "index مطلوب كرقم" });
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: "مطلوب ملف واحد على الأقل" });
      if (!userId) return res.status(400).json({ message: "userId مطلوب" });

      try {
            const { rows } = await pool.query(`SELECT * FROM "reports" WHERE id = $1`, [reportId]);
            if (!rows[0]) return res.status(404).json({ message: "التقرير غير موجود" });

            const report = rows[0];

            let arr = report[type];
            if (typeof arr === 'string') {
                  try { arr = JSON.parse(arr); } catch (e) { arr = []; }
            }
            if (!Array.isArray(arr)) arr = [];

            if (idx < 0 || idx >= arr.length) return res.status(400).json({ message: "index خارج نطاق المصفوفة" });

            // رفع الملفات وجمع اللينكات المباشرة
            const fileUrls = [];
            for (const file of req.files) {
                  const url = await uploadFileToS3(file);
                  fileUrls.push(url);
            }

            // دمج مع الموجود وإضافة userId
            const existing = arr[idx].result;
            let newResult;
            if (existing) {
                  if (Array.isArray(existing)) newResult = [...existing, ...fileUrls.map(u => ({ url: u, userId }))];
                  else newResult = [existing, ...fileUrls.map(u => ({ url: u, userId }))];
            } else {
                  newResult = fileUrls.length === 1 ? { url: fileUrls[0], userId } : fileUrls.map(u => ({ url: u, userId }));
            }

            arr[idx].result = newResult;

            const updateQuery = `UPDATE "reports" SET "${type}" = $1 WHERE id = $2 RETURNING *`;
            const updateValues = [JSON.stringify(arr), reportId];
            await pool.query(updateQuery, updateValues);

            return res.status(200).json({ message: "success" }); // 👈 نرجع success فقط
      } catch (err) {
            console.error("DB error in addResult:", err);
            return res.status(500).json({ message: "failed", error: err.message }); // 👈 نرجع failed لو حصل خطأ
      }
}

module.exports = { addResult };
