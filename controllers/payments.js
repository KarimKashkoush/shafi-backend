const pool = require("../db");

// إضافة دفعة جديدة
async function addPayment(req, res) {
      try {
            const { patientNationalId, doctorId, sessionId, amount, paymentMethod, notes } = req.body;

            if (!patientNationalId || !doctorId || !amount) {
                  return res.status(400).json({ error: "patientNationalId, doctorId, and amount are required" });
            }

const result = await pool.query(
      `INSERT INTO payments ("patientNationalId", "doctorId", "sessionId", "amount", "paymentMethod", "notes")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "patientNationalId", "doctorId", "sessionId", "amount", "paymentMethod", "notes"`,
      [patientNationalId, doctorId, sessionId || null, amount, paymentMethod || null, notes || null]
);



            res.status(201).json({ success: true, payment: result.rows[0] });
      } catch (error) {
            console.error("Database error:", error);
            res.status(500).json({ error: error.message });
      }
}

// استرجاع المدفوعات + المتبقي لكل مريض عند دكتور معين
async function getPaymentsByDoctor(req, res) {
      try {
            const { doctorId } = req.params;

            const paymentsData = await pool.query(
                  `SELECT 
            r.patientId,
            up.name AS patientName,
            r.doctorId,
            ud.name AS doctorName,
            SUM(r."sessionCost") AS totalAmount,
            COALESCE(SUM(p.amount), 0) AS totalPaid,
            SUM(r."sessionCost") - COALESCE(SUM(p.amount), 0) AS remainingAmount
            FROM result r
            LEFT JOIN payments p
            ON r.patientId = p.patientId AND r.doctorId = p.doctorId
            LEFT JOIN users up ON r.patientId = up.id
            LEFT JOIN users ud ON r.doctorId = ud.id
            WHERE r.doctorId = $1
            GROUP BY r.patientId, up.name, r.doctorId, ud.name`,
                  [doctorId]
            );

            res.json(paymentsData.rows);
      } catch (error) {
            console.error("Database error:", error);
            res.status(500).json({ error: error.message });
      }
}

module.exports = { addPayment, getPaymentsByDoctor };
