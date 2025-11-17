import pool from "../db.js"; // تأكد إن مكان pool صحيح

export const getPatientReports = async (req, res) => {
  try {
    const { nationalId } = req.params;

    if (!nationalId) {
      return res.status(400).json({ message: "National ID required" });
    }

    // جلب المواعيد + النتائج المرتبطة بكل موعد
    const result = await pool.query(
      `SELECT 
          a.*,
          json_agg(r.*) FILTER (WHERE r.id IS NOT NULL) AS result
       FROM appointments a
       LEFT JOIN result r ON a.id = r."appointmentId"
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
