const pool = require('../db');
const { uploadFileToS3, deleteFromS3 } = require("../middleware/s3");
const { toUtcIso } = require("../utils/datetime");

const safeParseJson = (val, fallback) => {
      if (val === undefined || val === null || val === "") return fallback;

      // لو جاي أصلا object/array (مثلا لو endpoint مش multipart)
      if (typeof val === "object") return val;

      // لو جاي string من multipart
      if (typeof val === "string") {
            try {
                  return JSON.parse(val);
            } catch (e) {
                  // لو جالك نص عادي مش JSON
                  return fallback;
            }
      }

      return fallback;
};

const safeParseArray = (val) => {
      const parsed = safeParseJson(val, []);
      return Array.isArray(parsed) ? parsed : [];
};

// ✅ لو احتجت object (مش مستخدم هنا بس مفيد)
const safeParseObject = (val) => {
      const parsed = safeParseJson(val, {});
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const addAppointment = async (req, res) => {
      try {
            const userId = req.body.userId || null;
            const caseName = req.body.caseName || null;
            const phone = req.body.phone || null;
            const nationalId = req.body.nationalId || null;
            const testName = req.body.testName || null;
            const doctorId = req.body.doctorId || null;
            const dateTime = req.body.dateTime || null;
            const isRevisit = req.body.isRevisit || false;

            // الحقول الجديدة
            const birthDate = req.body.birthDate || null;
            const hasChronicDisease = req.body.hasChronicDisease || false;
            const chronicDiseaseDetails = req.body.chronicDiseaseDetails || null;
            const price = req.body.price || null;

            const normalizedDateTime = dateTime ? toUtcIso(dateTime) : null;
            const normalizedBirthDate = birthDate ? toUtcIso(birthDate, { dateOnly: true }) : null;

            if (dateTime && !normalizedDateTime) {
                  return res.status(400).json({ message: "تاريخ / وقت الحجز غير صالح" });
            }

            if (birthDate && !normalizedBirthDate) {
                  return res.status(400).json({ message: "تاريخ الميلاد غير صالح" });
            }

            // جلب medicalCenterId مباشرة من جدول users
            let medicalCenterId = null;
            if (userId) {
                  const userQuery = await pool.query(
                        'SELECT "medicalCenterId" FROM users WHERE id = $1',
                        [userId]
                  );
                  if (userQuery.rows.length > 0) {
                        medicalCenterId = userQuery.rows[0].medicalCenterId;
                  }
            }

            // التعامل مع fileNumber
            let fileNumber = null;

            if (caseName) {
                  // نبحث لو فيه أي حجز بنفس الاسم
                  const existingQuery = await pool.query(
                        `SELECT "fileNumber" FROM appointments 
     WHERE "caseName" = $1 LIMIT 1`,
                        [caseName]
                  );

                  if (existingQuery.rows.length > 0) {
                        // الاسم موجود → استخدم نفس الرقم
                        fileNumber = existingQuery.rows[0].fileNumber;
                  } else {
                        // الاسم جديد → رقم جديد
                        const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                        fileNumber = seqResult.rows[0].nextval;
                  }
            } else {
                  // لو الاسم مش موجود، نولّد رقم جديد
                  const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                  fileNumber = seqResult.rows[0].nextval;
            }

            // لو مفيش ملف موجود، نولّد رقم جديد
            if (!fileNumber) {
                  const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                  fileNumber = seqResult.rows[0].nextval;
            }

            const query = `
      INSERT INTO appointments 
      ("userId", "caseName", "phone", "nationalId", "testName", "doctorId",
       "medicalCenterId", "dateTime", "birthDate", "hasChronicDisease",
       "chronicDiseaseDetails", "price", "isRevisit", "fileNumber")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

            const values = [
                  userId,
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  doctorId,
                  medicalCenterId,
                  normalizedDateTime,
                  normalizedBirthDate,
                  hasChronicDisease,
                  chronicDiseaseDetails,
                  price,
                  isRevisit,
                  fileNumber
            ];

            const result = await pool.query(query, values);

            res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in addAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

const getAppointmentsUser = async (req, res) => {
      try {
            // تأكد إن المستخدم مسجل
            if (!req.user?.id) {
                  return res.status(401).json({ message: "المستخدم غير موجود" });
            }

            // جلب medicalCenterId للمستخدم
            const userQuery = await pool.query(
                  `SELECT "medicalCenterId" FROM users WHERE id = $1`,
                  [req.user.id]
            );

            if (userQuery.rows.length === 0) {
                  return res.status(404).json({ message: "المستخدم غير موجود" });
            }

            const medicalCenterId = userQuery.rows[0].medicalCenterId;

            // جلب كل المواعيد الخاصة بهذا المركز
            const appointmentsQuery = await pool.query(
                  `SELECT * FROM appointments WHERE "medicalCenterId" = $1 ORDER BY "dateTime" DESC`,
                  [medicalCenterId]
            );

            res.json({ message: "success", data: appointmentsQuery.rows });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: "error", error: error.message });
      }
};


const addResultToAppointment = async (req, res) => {
      try {
            const { id } = req.params;

            let {
                  userId,
                  report,
                  nextAction,
                  sessionCost,
                  medicalCenterId,
                  medications,
                  radiology,
                  labTests
            } = req.body;

            if (!userId) {
                  return res.status(400).json({ message: "userId (الدكتور) مطلوب" });
            }

            // ✅ Parse (jsonb columns => نخزن arrays/objects زي ما هي)
            report = safeParseArray(report);
            nextAction = safeParseArray(nextAction);
            medications = safeParseArray(medications);
            radiology = safeParseArray(radiology);
            labTests = safeParseArray(labTests);

            // هات بيانات الحجز
            const apptRes = await pool.query(
                  `SELECT "caseName", "phone", "nationalId", "testName"
       FROM appointments WHERE id = $1`,
                  [id]
            );

            if (!apptRes.rowCount) {
                  return res.status(404).json({ message: "الحجز مش موجود" });
            }

            const { caseName, phone, nationalId, testName } = apptRes.rows[0];

            // رفع الملفات
            let uploadedFiles = [];
            if (req.files?.length) {
                  const uploaded = await Promise.all(req.files.map(file => uploadFileToS3(file)));
                  uploadedFiles = uploaded.map(x => x.url); // ✅ بدون const
            }


            // ✅ لو العمود files jsonb برضه: خزّن array
            // uploadedFiles غالبًا array of urls
            const query = `
  INSERT INTO "patientsReports" (
    "appointmentId","doctorId","caseName","phone","nationalId","testName",
    "files","report","nextAction","sessionCost","medicalCenterId",
    "medications","radiology","labTests"
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,
    $7::jsonb,$8::jsonb,$9::jsonb,$10,$11,
    $12::jsonb,$13::jsonb,$14::jsonb
  )
  RETURNING *
`;


            const values = [
                  id,
                  userId,
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  JSON.stringify(uploadedFiles),   // ✅
                  JSON.stringify(report),          // ✅
                  JSON.stringify(nextAction),      // ✅
                  Number(sessionCost) || 0,
                  medicalCenterId || null,
                  JSON.stringify(medications),     // ✅
                  JSON.stringify(radiology),       // ✅
                  JSON.stringify(labTests)         // ✅
            ];


            const result = await pool.query(query, values);

            res.status(201).json({
                  message: "success",
                  data: result.rows[0]
            });

      } catch (error) {
            console.error("❌ addResultToAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

const updateResultAppointment = async (req, res) => {
      try {
            const { id, reportId } = req.params;

            let {
                  report,
                  nextAction,
                  sessionCost,
                  medications,
                  radiology,
                  labTests
            } = req.body;

            // ✅ Parse
            report = safeParseArray(report);
            nextAction = safeParseArray(nextAction);
            medications = safeParseArray(medications);
            radiology = safeParseArray(radiology);
            labTests = safeParseArray(labTests);

            // الملفات الجديدة
            let newFiles = [];
            if (req.files?.length) {
                  const uploaded = await Promise.all(req.files.map(file => uploadFileToS3(file)));
                  newFiles = uploaded.map(x => x.url);
            }

            // هات الملفات القديمة (jsonb array)
            const oldRes = await pool.query(
                  `SELECT "files" FROM "patientsReports" WHERE id = $1`,
                  [reportId]
            );

            if (!oldRes.rowCount) {
                  return res.status(404).json({ message: "التقرير غير موجود" });
            }

            const oldFiles = Array.isArray(oldRes.rows[0].files) ? oldRes.rows[0].files : [];
            const allFiles = [...oldFiles, ...newFiles];

            const updateQuery = `
  UPDATE "patientsReports"
  SET
    "report" = $1::jsonb,
    "nextAction" = $2::jsonb,
    "sessionCost" = $3,
    "files" = $4::jsonb,
    "medications" = $5::jsonb,
    "radiology" = $6::jsonb,
    "labTests" = $7::jsonb,
    "updatedAt" = NOW()
  WHERE id = $8 AND "appointmentId" = $9
  RETURNING *
`;


            const values = [
                  JSON.stringify(report),
                  JSON.stringify(nextAction),
                  Number(sessionCost) || 0,
                  JSON.stringify(allFiles),
                  JSON.stringify(medications),
                  JSON.stringify(radiology),
                  JSON.stringify(labTests),
                  reportId,
                  id
            ];


            const updated = await pool.query(updateQuery, values);

            res.json({
                  message: "updated",
                  data: updated.rows[0]
            });

      } catch (error) {
            console.error("❌ updateResultAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};


const getAppointmentsWithResults = async (req, res) => {
      try {
            const query = `
      SELECT 
            a.id,
            a."userId",
            a."caseName",
            a."phone",
            a."nationalId",
            a."testName",
            a."createdAt",
            a."dateTime",
            a."birthDate",
            a."hasChronicDisease",
            a."chronicDiseaseDetails",
            a.price,
            a."isRevisit",

            r.files AS "resultFiles",
            r."createdAt" AS "resultCreatedAt",
            r."sessionCost" AS "sessionCost",
            r."report" AS "resultReports",


            d.id AS "doctorId",
            u.id AS "doctorUserId"
      FROM appointments a
      LEFT JOIN "patientsReports" r ON a.id = r."appointmentId"
      LEFT JOIN doctors d ON a."doctorId" = d.id
      LEFT JOIN users u ON d."userId" = u.id
      ORDER BY a."createdAt" DESC;
      `;

            const result = await pool.query(query);
            res.json({ message: "success", data: result.rows });
      } catch (error) {
            console.error("❌ Error in getAppointmentsWithResults:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

const getAppointmentsForDashboard = async (req, res) => {
      try {
            const { id } = req.params; // ده هيبقى userId

            const query = `
SELECT 
      a.id,
      a."caseName",
      a."dateTime",
      a.price,
      a."isRevisit",
      r."sessionCost",
      r."doctorId",
      u."fullName" AS "doctorName",
      r."report" AS "report",
      r."createdAt" AS "createdAt"
      FROM appointments a
      LEFT JOIN "patientsReports" r ON a.id = r."appointmentId"
      LEFT JOIN users u ON r."doctorId" = u.id
      WHERE a."userId" = $1
      ORDER BY a."createdAt" DESC;
      `;

            const result = await pool.query(query, [id]);
            res.json({ message: "success", data: result.rows });
      } catch (error) {
            console.error("❌ Error in getAppointmentsForDashboard:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

// ✅ 4. حذف حجز بالـ id
const deleteAppointment = async (req, res) => {
      try {
            const { id } = req.params;

            // 1️⃣ جلب ملفات النتائج من DB
            const { rows: reports } = await pool.query(
                  `SELECT files FROM "patientsReports" WHERE "appointmentId" = $1`,
                  [id]
            );

            // 2️⃣ حذف كل ملف من S3
            for (const report of reports) {
                  if (report.files) {
                        // لو files عبارة عن array بالفعل
                        let filesArray = [];
                        if (Array.isArray(report.files)) {
                              filesArray = report.files;
                        } else if (typeof report.files === "string") {
                              // لو string، حاول تقسيمه على , أو خليه array من عنصر واحد
                              try {
                                    filesArray = JSON.parse(report.files);
                              } catch {
                                    filesArray = [report.files]; // بس خليها array من عنصر واحد
                              }
                        }

                        for (const fileUrl of filesArray) {
                              try {
                                    await deleteFromS3(fileUrl);
                                    console.log(`✅ Deleted file from S3: ${fileUrl}`);
                              } catch (err) {
                                    console.error(`❌ Failed to delete file ${fileUrl}:`, err);
                              }
                        }
                  }
            }


            // 3️⃣ حذف السجلات من DB
            await pool.query(`DELETE FROM "patientsReports" WHERE "appointmentId" = $1`, [id]);
            await pool.query(`DELETE FROM payments WHERE "appointmentId" = $1`, [id]);
            const { rows: deletedAppointments, rowCount } = await pool.query(
                  `DELETE FROM appointments WHERE id = $1 RETURNING *`,
                  [id]
            );

            if (rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({
                  message: "تم حذف الحجز مع الملفات والنتائج والمدفوعات المرتبطة",
                  data: deletedAppointments[0],
            });
      } catch (error) {
            console.error("❌ Error in deleteAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};
// controllers/appointments.js
const updateAppointment = async (req, res) => {
      try {
            const { id } = req.params;
            const updatedData = req.body; // كل البيانات اللي عايز تحدثها

            // 1️⃣ جلب الحجز الحالي
            const apptRes = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
            if (apptRes.rowCount === 0)
                  return res.status(404).json({ message: "الحجز غير موجود" });

            const appointment = apptRes.rows[0];

            // 2️⃣ تحديث كل البيانات
            const fields = Object.keys(updatedData);
            const values = Object.values(updatedData);

            const setString = fields.map((f, idx) => `"${f}" = $${idx + 1}`).join(", ");

            await pool.query(
                  `UPDATE appointments SET ${setString} WHERE id = $${fields.length + 1}`,
                  [...values, id]
            );

            res.json({ message: "success", data: { ...appointment, ...updatedData } });
      } catch (error) {
            console.error("❌ Error in updateAppointment:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

const getAppointmentById = async (req, res) => {
      try {
            const { id } = req.params;

            const query = `
      SELECT 
        a.id,
        a."userId",
        a."caseName",
        a."phone",
        a."nationalId",
        a."testName",
        a."createdAt",
        r.files AS "resultFiles",
        r."createdAt" AS "resultCreatedAt",
        u."fullName" AS "doctorName",
        u."phoneNumber" AS "doctorPhone",
        d.specialty AS "doctorSpecialty"
      FROM appointments a
      LEFT JOIN "patientsReports" r ON a.id = r."appointmentId"
      LEFT JOIN doctors d ON a."doctorId" = d.id
      LEFT JOIN users u ON d."userId" = u.id
      LEFT JOIN payments p ON a.id = p."appointmentId"
      WHERE a.id = $1
      LIMIT 1
    `;

            const result = await pool.query(query, [id]);

            if (result.rowCount === 0) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in getAppointmentById:", error);
            res.status(500).json({ message: "error", error: error.message });
      }
};

module.exports = {
      addAppointment,
      addResultToAppointment,
      getAppointmentsWithResults,
      deleteAppointment,
      updateAppointment,
      getAppointmentById,
      getAppointmentsForDashboard,
      updateResultAppointment,
      getAppointmentsUser
};
