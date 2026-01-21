// controllers/appointments.js
const pool = require('../db');
const { uploadFileToS3, deleteFromS3 } = require("../middleware/s3");
const { toUtcIso } = require("../utils/datetime");

const safeParseJson = (val, fallback) => {
      if (val === undefined || val === null || val === "") return fallback;

      if (typeof val === "object") return val;

      if (typeof val === "string") {
            try {
                  return JSON.parse(val);
            } catch (e) {
                  return fallback;
            }
      }

      return fallback;
};

const safeParseArray = (val) => {
      const parsed = safeParseJson(val, []);
      return Array.isArray(parsed) ? parsed : [];
};

const safeParseObject = (val) => {
      const parsed = safeParseJson(val, {});
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const addAppointment = async (req, res) => {
      try {
            // ✅ عندك userId = medicalCenterId (قاصدها)
            const userId = req.body.userId || null;

            const caseName = req.body.caseName || null;
            const phone = req.body.phone || null;
            const nationalId = req.body.nationalId || null;
            const testName = req.body.testName || null;
            const doctorId = req.body.doctorId || null;
            const dateTime = req.body.dateTime || null;
            const isRevisit = !!req.body.isRevisit;

            // الحقول الإضافية القديمة
            const birthDate = req.body.birthDate || null;
            const hasChronicDisease = !!req.body.hasChronicDisease;
            const chronicDiseaseDetails = req.body.chronicDiseaseDetails || null;
            const price = req.body.price ?? null;

            // ✅ الحقول الجديدة (تحويل)
            const isReferred = !!req.body.isReferred;
            const referredFromDoctorRaw = req.body.referredFromDoctor || null;
            const referredFromDoctor = referredFromDoctorRaw
                  ? String(referredFromDoctorRaw).trim()
                  : null;

            // Normalize name/phone
            const cleanName = String(caseName ?? "").trim();
            const cleanPhone = String(phone ?? "").replace(/\s+/g, "").trim();

            if (isReferred && !referredFromDoctor) {
                  return res.status(400).json({ message: "اكتب اسم الدكتور اللي محوّل الحالة" });
            }

            const normalizedDateTime = dateTime ? toUtcIso(dateTime) : null;
            const normalizedBirthDate = birthDate ? toUtcIso(birthDate, { dateOnly: true }) : null;

            if (dateTime && !normalizedDateTime) {
                  return res.status(400).json({ message: "تاريخ / وقت الحجز غير صالح" });
            }

            if (birthDate && !normalizedBirthDate) {
                  return res.status(400).json({ message: "تاريخ الميلاد غير صالح" });
            }

            // ✅ بما إنك قاصد userId = medicalCenterId
            const medicalCenterId = userId || null;

            // =========================
            // ✅ التعامل مع fileNumber
            // =========================
            let fileNumber = null;

            if (cleanName && cleanPhone) {
                  const existingQuery = await pool.query(
                        `
        SELECT "fileNumber"
        FROM appointments
        WHERE "medicalCenterId" = $1
          AND lower(trim("caseName")) = lower(trim($2))
          AND regexp_replace(coalesce("phone", ''), '\\s+', '', 'g') = $3
        ORDER BY "createdAt" ASC
        LIMIT 1
        `,
                        [medicalCenterId, cleanName, cleanPhone]
                  );

                  if (existingQuery.rows.length > 0 && existingQuery.rows[0].fileNumber) {
                        fileNumber = existingQuery.rows[0].fileNumber;
                  } else {
                        const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                        fileNumber = seqResult.rows[0].nextval;
                  }
            } else {
                  const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                  fileNumber = seqResult.rows[0].nextval;
            }

            if (!fileNumber) {
                  const seqResult = await pool.query(`SELECT nextval('file_number_seq')`);
                  fileNumber = seqResult.rows[0].nextval;
            }

            // =========================
            // INSERT
            // =========================
            const query = `
      INSERT INTO appointments 
      ("userId", "caseName", "phone", "nationalId", "testName", "doctorId",
       "medicalCenterId", "dateTime", "birthDate", "hasChronicDisease",
       "chronicDiseaseDetails", "price", "isRevisit", "fileNumber",
       "isReferred", "referredFromDoctor")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;

            const values = [
                  userId,
                  cleanName || null,
                  cleanPhone || null,
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
                  fileNumber,
                  isReferred,
                  referredFromDoctor,
            ];

            const result = await pool.query(query, values);

            return res.json({ message: "success", data: result.rows[0] });
      } catch (error) {
            console.error("❌ Error in addAppointment:", error);
            return res.status(500).json({ message: "error", error: error.message });
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
                  labTests,
                  notes,
            } = req.body;

            if (!userId) {
                  return res.status(400).json({ message: "userId (الدكتور) مطلوب" });
            }

            report = safeParseArray(report);
            nextAction = safeParseArray(nextAction);
            medications = safeParseArray(medications);
            radiology = safeParseArray(radiology);
            labTests = safeParseArray(labTests);

            const cleanNotes = notes ? String(notes).trim() : null;

            // هات بيانات الحجز + medicalCenterId الحقيقي للحجز (مهم للربط)
            const apptRes = await pool.query(
                  `
      SELECT "caseName", "phone", "nationalId", "testName", "medicalCenterId"
      FROM appointments
      WHERE id = $1
      `,
                  [id]
            );

            if (!apptRes.rowCount) {
                  return res.status(404).json({ message: "الحجز مش موجود" });
            }

            const {
                  caseName,
                  phone,
                  nationalId,
                  testName,
                  medicalCenterId: apptMedicalCenterId
            } = apptRes.rows[0];

            // لو request مبعوت فيه medicalCenterId سيبه، وإلا خده من الحجز
            const finalMedicalCenterId = medicalCenterId || apptMedicalCenterId || null;

            // رفع الملفات
            let uploadedFiles = [];
            if (req.files?.length) {
                  const uploaded = await Promise.all(req.files.map((file) => uploadFileToS3(file)));
                  uploadedFiles = uploaded.map((x) => x.url);
            }

            // ✅ INSERT مع notes
            const query = `
      INSERT INTO "patientsReports" (
        "appointmentId","doctorId","caseName","phone","nationalId","testName",
        "files","report","nextAction","sessionCost","medicalCenterId",
        "medications","radiology","labTests",
        "notes"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7::jsonb,$8::jsonb,$9::jsonb,$10,$11,
        $12::jsonb,$13::jsonb,$14::jsonb,
        $15
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
                  JSON.stringify(uploadedFiles),
                  JSON.stringify(report),
                  JSON.stringify(nextAction),
                  Number(sessionCost) || 0,
                  finalMedicalCenterId,
                  JSON.stringify(medications),
                  JSON.stringify(radiology),
                  JSON.stringify(labTests),
                  cleanNotes,
            ];

            const result = await pool.query(query, values);

            // ✅✅ الجديد: اربط أي مدفوعات قديمة (قبل التقرير) بالتقرير الجديد
            const newReportId = result.rows[0].id;

            await pool.query(
                  `
      UPDATE payments
      SET "sessionId" = $1
      WHERE "appointmentId" = $2
        AND "medicalCenterId" = $3
        AND "sessionId" IS NULL
      `,
                  [newReportId, id, finalMedicalCenterId]
            );

            res.status(201).json({
                  message: "success",
                  data: result.rows[0],
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
                  labTests,
                  notes,
            } = req.body;

            report = safeParseArray(report);
            nextAction = safeParseArray(nextAction);
            medications = safeParseArray(medications);
            radiology = safeParseArray(radiology);
            labTests = safeParseArray(labTests);

            const cleanNotes = notes ? String(notes).trim() : null;

            // الملفات الجديدة
            let newFiles = [];
            if (req.files?.length) {
                  const uploaded = await Promise.all(req.files.map((file) => uploadFileToS3(file)));
                  newFiles = uploaded.map((x) => x.url);
            }

            // هات الملفات القديمة
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
        "notes" = $8,
        "updatedAt" = NOW()
      WHERE id = $9 AND "appointmentId" = $10
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
                  cleanNotes,
                  reportId,
                  id,
            ];

            const updated = await pool.query(updateQuery, values);

            res.json({
                  message: "updated",
                  data: updated.rows[0],
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
            a."fileNumber",

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
            const { id } = req.params;

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
                        let filesArray = [];
                        if (Array.isArray(report.files)) {
                              filesArray = report.files;
                        } else if (typeof report.files === "string") {
                              try {
                                    filesArray = JSON.parse(report.files);
                              } catch {
                                    filesArray = [report.files];
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

            if (!rowCount) {
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

const updateAppointment = async (req, res) => {
      try {
            const { id } = req.params;
            const updatedData = req.body || {};

            const apptRes = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
            if (!apptRes.rowCount) {
                  return res.status(404).json({ message: "الحجز غير موجود" });
            }

            const appointment = apptRes.rows[0];
            const fileNumber = appointment.fileNumber;
            const medicalCenterId = appointment.medicalCenterId;

            if (!fileNumber || !medicalCenterId) {
                  return res.status(400).json({ message: "رقم الملف أو المركز غير موجودين للحجز" });
            }

            const PATIENT_FIELDS = new Set([
                  "caseName",
                  "phone",
                  "nationalId",
                  "birthDate",
                  "hasChronicDisease",
                  "chronicDiseaseDetails",
            ]);

            const APPOINTMENT_ONLY_FIELDS = new Set([
                  "dateTime",
                  "doctorId",
                  "testName",
                  "price",
                  "isRevisit",
                  "userId",
            ]);

            const FORBIDDEN_FIELDS = new Set(["id", "fileNumber", "medicalCenterId", "createdAt"]);

            const cleaned = {};
            for (const [k, v] of Object.entries(updatedData)) {
                  if (FORBIDDEN_FIELDS.has(k)) continue;
                  cleaned[k] = v;
            }

            const patientUpdates = {};
            const appointmentUpdates = {};

            for (const [k, v] of Object.entries(cleaned)) {
                  if (PATIENT_FIELDS.has(k)) patientUpdates[k] = v;
                  else if (APPOINTMENT_ONLY_FIELDS.has(k)) appointmentUpdates[k] = v;
            }

            const buildUpdate = (obj, startIndex = 1) => {
                  const fields = Object.keys(obj);
                  const values = Object.values(obj);
                  const setString = fields.map((f, idx) => `"${f}" = $${idx + startIndex}`).join(", ");
                  return { fields, values, setString };
            };

            let updatedRowsCount = 0;

            if (Object.keys(patientUpdates).length > 0) {
                  const { values, setString, fields } = buildUpdate(patientUpdates, 1);

                  const q = `
        UPDATE appointments
        SET ${setString}
        WHERE "medicalCenterId" = $${fields.length + 1}
          AND "fileNumber" = $${fields.length + 2}
      `;

                  const r = await pool.query(q, [...values, medicalCenterId, fileNumber]);
                  updatedRowsCount += r.rowCount || 0;
            }

            if (Object.keys(appointmentUpdates).length > 0) {
                  const { values, setString, fields } = buildUpdate(appointmentUpdates, 1);

                  const q = `
        UPDATE appointments
        SET ${setString}
        WHERE id = $${fields.length + 1}
      `;

                  await pool.query(q, [...values, id]);
            }

            const finalRes = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);

            return res.json({
                  message: "success",
                  data: finalRes.rows[0],
                  updatedPatientAppointments: updatedRowsCount,
            });
      } catch (error) {
            console.error("❌ Error in updateAppointment:", error);
            return res.status(500).json({ message: "error", error: error.message });
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

            if (!result.rowCount) {
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
};
