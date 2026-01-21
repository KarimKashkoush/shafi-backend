// controllers/patientFiles.js (getPatientReports)
const pool = require("../db");

const getPatientReports = async (req, res) => {
  try {
    const { identifier } = req.params; // identifier = fileNumber

    if (!identifier) {
      return res.status(400).json({ message: "fileNumber required" });
    }

    const fileNumber = Number(identifier);

    if (Number.isNaN(fileNumber)) {
      return res.status(400).json({ message: "Invalid fileNumber" });
    }

    const result = await pool.query(
      `
      SELECT 
        a.*,
        COALESCE(
          json_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS result,
        COALESCE(
          json_agg(DISTINCT p.*) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS payments
      FROM appointments a
      LEFT JOIN "patientsReports" r 
        ON a.id = r."appointmentId"
      LEFT JOIN payments p
        ON p."appointmentId" = a.id
       AND p."medicalCenterId" = a."medicalCenterId"
      WHERE a."fileNumber" = $1
      GROUP BY a.id
      ORDER BY a."createdAt" ASC
      `,
      [fileNumber]
    );

    res.json({ message: "success", data: result.rows });
  } catch (error) {
    console.error("Error in getPatientReports:", error);
    res.status(500).json({ message: "error", error: error.message });
  }
};

module.exports = { getPatientReports };
