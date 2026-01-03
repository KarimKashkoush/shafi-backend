const pool = require("../db");

// إضافة دفعة جديدة
async function addPayment(req, res) {
    try {
        const {
            patientNationalId,
            patientPhone,
            doctorId,
            sessionId,
            appointmentId,
            amount,
            paymentMethod,
            notes,
            medicalCenterId
        } = req.body;

        if (!doctorId || !amount || !medicalCenterId || !appointmentId)
            return res.status(400).json({ error: "doctorId, amount, medicalCenterId, appointmentId required" });

        const result = await pool.query(
            `INSERT INTO payments
            ("patientNationalId", "patientPhone", "doctorId", "sessionId", "appointmentId", "amount", "paymentMethod", "notes", "medicalCenterId")
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *`,
            [patientNationalId || null, patientPhone || null, doctorId, sessionId || null, appointmentId, amount, paymentMethod || null, notes || null, medicalCenterId]
        );

        res.status(201).json({ success: true, payment: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}



const getPaymentsByMedicalCenter = async (req, res) => {
    try {
        const { medicalCenterId } = req.params;

        if (!medicalCenterId) {
            return res.status(400).json({ error: "medicalCenterId مطلوب" });
        }

        const result = await pool.query(
            `SELECT *
            FROM payments
            WHERE "medicalCenterId" = $1
            ORDER BY "paymentdate" DESC`,
            [medicalCenterId]
        );

        res.status(200).json({ success: true, payments: result.rows });
    } catch (error) {
        console.error("❌ Error fetching payments:", error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = { addPayment, getPaymentsByMedicalCenter };
