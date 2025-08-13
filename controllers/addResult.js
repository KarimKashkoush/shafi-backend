// controllers/addResult.js
const pool = require('../db');

async function addResult(req, res) {
      const reportId = parseInt(req.params.reportId || req.body.reportId, 10);
      const { type, index } = req.body; // type = "radiology" or "labTests", index = رقم العنصر

      if (!reportId) return res.status(400).json({ message: "reportId مطلوب" });
      if (!type || !['radiology', 'labTests'].includes(type)) {
            return res.status(400).json({ message: 'type مطلوب ويكون "radiology" أو "labTests"' });
      }
      const idx = parseInt(index, 10);
      if (Number.isNaN(idx)) return res.status(400).json({ message: "index مطلوب كرقم" });
      if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "مطلوب ملف واحد على الأقل" });
      }

      try {
            const { rows } = await pool.query(`SELECT * FROM "Reports" WHERE id = $1`, [reportId]);
            if (!rows[0]) return res.status(404).json({ message: "التقرير غير موجود" });

            const report = rows[0];

            // اقرأ المصفوفة المطلوبة بطريقة آمنة (string أو object)
            let arr = report[type];
            if (typeof arr === 'string') {
                  try { arr = JSON.parse(arr); } catch (e) { arr = []; }
            }
            if (!Array.isArray(arr)) arr = [];

            if (idx < 0 || idx >= arr.length) {
                  return res.status(400).json({ message: "index خارج نطاق المصفوفة" });
            }

            // ملفات مخزنة في uploads => نبني المسارات اللي هتتحخزن في DB
            const fileUrls = req.files.map(f => `/uploads/${f.filename}`);

            // ندمج/نستبدل الـ result في العنصر المستهدف
            const existing = arr[idx].result;
            let newResult;
            if (existing) {
                  // لو فيه نتيجة سابقة ندمجها مع الحالية
                  if (Array.isArray(existing)) newResult = [...existing, ...fileUrls];
                  else newResult = [existing, ...fileUrls];
            } else {
                  // لو مفيش نتيجة قبل كده: لو ملف واحد خليه string غير كده خلي array
                  newResult = fileUrls.length === 1 ? fileUrls[0] : fileUrls;
            }

            arr[idx].result = newResult;

            // إحنا بنخزن كـ JSON string علشان متأكدين من التوافق مع عمود json/jsonb
            const updateQuery = `UPDATE "Reports" SET "${type}" = $1 WHERE id = $2 RETURNING *`;
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
