const pool = require('../db');
const { uploadFileToS3 } = require('../middleware/s3');

async function addResult(req, res) {
      const reportId = parseInt(req.params.reportId || req.body.reportId, 10);
      const { type, index } = req.body;

      if (!reportId) return res.status(400).json({ message: "reportId مطلوب" });
      if (!type || !['radiology', 'labTests'].includes(type)) {
            return res.status(400).json({ message: 'type مطلوب ويكون "radiology" أو "labTests"' });
      }
      const idx = parseInt(index, 10);
      if (Number.isNaN(idx)) return res.status(400).json({ message: "index مطلوب كرقم" });
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: "مطلوب ملف واحد على الأقل" });

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

            const fileUrls = [];
            for (const file of req.files) {
                  const url = await uploadFileToS3(file);
                  fileUrls.push(url);
            }

            const existing = arr[idx].result;
            let newResult;
            if (existing) {
                  if (Array.isArray(existing)) newResult = [...existing, ...fileUrls];
                  else newResult = [existing, ...fileUrls];
            } else {
                  newResult = fileUrls.length === 1 ? fileUrls[0] : fileUrls;
            }

            arr[idx].result = newResult;

            const updateQuery = `UPDATE "reports" SET "${type}" = $1 WHERE id = $2 RETURNING *`;
            const updateValues = [JSON.stringify(arr), reportId];
            const { rows: updatedRows } = await pool.query(updateQuery, updateValues);

            return res.status(200).json({
                  message: "تم إضافة النتيجة بنجاح",
                  report: updatedRows[0],
                  added: fileUrls
            });
      } catch (err) {
            console.error("DB error in addResult:", err);
            return res.status(500).json({ message: "حدث خطأ أثناء رفع الملفات", error: err.message });
      }
}

module.exports = { addResult };
