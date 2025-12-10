import pool from "../db.js";

export const getPatientReports = async (req, res) => {
  try {
    const { nationalId } = req.params;

    if (!nationalId) {
      return res.status(400).json({ message: "National ID required" });
    }

    const result = await pool.query(
      `SELECT 
          a.*,
          json_agg(r.*) FILTER (WHERE r.id IS NOT NULL) AS result,
          -- جمع المدفوعات لكل نتيجة
          json_agg(p.*) FILTER (WHERE p.id IS NOT NULL) AS payments
       FROM appointments a
       LEFT JOIN result r ON a.id = r."appointmentId"
       LEFT JOIN LATERAL (
           SELECT *
           FROM payments p
           WHERE p."sessionId" = r.id
       ) p ON true
       WHERE a."nationalId" = $1
       GROUP BY a.id
       ORDER BY a."createdAt" DESC`,
      [nationalId]
    );

    res.json({ message: "success", data: result.rows });
  } catch (error) {
    console.error("Error in getPatientReports:", error);
    res.status(500).json({ message: "error", error: error.message });
  }
};

