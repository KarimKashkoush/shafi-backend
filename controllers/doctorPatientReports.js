const pool = require("../db");

const getPatientReports = async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier required" });
    }

    const cleanIdentifier = identifier.trim();
    const isNationalId = /^\d{14}$/.test(cleanIdentifier);

    const result = await pool.query(
      `
      SELECT 
        a.*,
        json_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL) AS result,
        json_agg(DISTINCT p.*) FILTER (WHERE p.id IS NOT NULL) AS payments
      FROM appointments a
      LEFT JOIN "patientsReports" r ON a.id = r."appointmentId"
      LEFT JOIN LATERAL (
        SELECT *
        FROM payments p
        WHERE p."sessionId" = r.id
      ) p ON true
      WHERE ${isNationalId ? `a."nationalId"` : `a.phone`} = $1
      GROUP BY a.id
      ORDER BY a."createdAt" DESC
      `,
      [cleanIdentifier]
    );

    res.json({ message: "success", data: result.rows });
  } catch (error) {
    console.error("Error in getPatientReports:", error);
    res.status(500).json({ message: "error", error: error.message });
  }
};

module.exports = { getPatientReports };
