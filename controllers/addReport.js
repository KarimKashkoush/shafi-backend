const pool = require("../db");

async function addReport(req, res) {
  const {
    userId,
    reportText,
    chronicDisease,
    chronicDiseaseName,
    medications,
    radiology,
    labTests,
    createdAt
  } = req.body;

  try {
    // ✅ radiology مع result=null
    const radiologyWithResult = radiology?.map(item => ({
      ...item,
      result: null
    }));

    // ✅ labTests مع result=null
    const labTestsWithResult = labTests?.map(item => ({
      ...item,
      result: null
    }));

const query = `
  INSERT INTO reports
  (userId, reportText, chronicDisease, chronicDiseaseName, medications, radiology, labTests, createdAt)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;


    const values = [
      userId,
      reportText || null,
      chronicDisease || null,
      chronicDiseaseName || null,
      medications ? JSON.stringify(medications) : null,
      radiology ? JSON.stringify(radiologyWithResult) : null,
      labTests ? JSON.stringify(labTestsWithResult) : null,
      createdAt || new Date().toISOString()
    ];

    const result = await pool.query(query, values);

    // ✅ تحويل الـ keys من snake_case → camelCase
    const row = result.rows[0];
    const formattedReport = {
      id: row.id,
      userId: row.user_id,
      reportText: row.report_text,
      chronicDisease: row.chronic_disease,
      chronicDiseaseName: row.chronic_disease_name,
      medications: row.medications,
      radiology: row.radiology,
      labTests: row.lab_tests,
      createdAt: row.created_at
    };

    res.status(201).json({
      message: "success",
      report: formattedReport
    });

  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ message: "خطأ في إضافة التقرير", error: error.message });
  }
}

module.exports = { addReport };
