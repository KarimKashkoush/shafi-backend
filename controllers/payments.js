const pool = require("../db");

// إضافة دفعة جديدة
async function addPayment(req, res) {
  const client = await pool.connect();
  try {
    const {
      patientNationalId,
      patientPhone,
      doctorId,
      sessionId,        // ده id بتاع patientsReports
      appointmentId,
      amount,
      paymentMethod,
      notes,
      medicalCenterId,
      sessionCost       // ✅ جديد: قيمه الجلسة لو مش متسجله
    } = req.body;

    if (!doctorId || !amount || !medicalCenterId || !appointmentId) {
      return res.status(400).json({
        error: "doctorId, amount, medicalCenterId, appointmentId required",
      });
    }

    await client.query("BEGIN");

    // ✅ لازم يبقى عندك sessionId عشان sessionCost في patientsReports
    if (!sessionId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "sessionId (patientsReports.id) required to attach payment",
      });
    }

    // 1) هات sessionCost الحالي من patientsReports
    const reportRow = await client.query(
      `
      SELECT id, "sessionCost"
      FROM "patientsReports"
      WHERE id = $1 AND "appointmentId" = $2 AND "medicalCenterId" = $3
      LIMIT 1
      `,
      [sessionId, appointmentId, medicalCenterId]
    );

    if (!reportRow.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Session report not found for this appointment/medicalCenter",
      });
    }

    const currentCost = Number(reportRow.rows[0].sessionCost || 0);
    const incomingCost = Number(sessionCost || 0);

    // 2) لو cost مش متحدد (0/null) والمستخدم بعت cost => حدّثه
    if (currentCost <= 0 && incomingCost > 0) {
      await client.query(
        `
        UPDATE "patientsReports"
        SET "sessionCost" = $1
        WHERE id = $2
        `,
        [incomingCost, sessionId]
      );
    }

    // 3) احسب max لو فيه cost فعلي عشان تمنع دفع زيادة
    const finalCost = currentCost > 0 ? currentCost : incomingCost;
    if (finalCost > 0) {
      const paidAgg = await client.query(
        `SELECT COALESCE(SUM(amount),0) AS paid
         FROM payments
         WHERE "sessionId" = $1`,
        [sessionId]
      );

      const alreadyPaid = Number(paidAgg.rows[0].paid || 0);
      const incomingAmount = Number(amount || 0);

      if (incomingAmount <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "amount must be > 0" });
      }

      if (alreadyPaid + incomingAmount > finalCost) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Amount exceeds remaining. Remaining = ${finalCost - alreadyPaid}`,
        });
      }
    }

    // 4) Insert payment
    const result = await client.query(
      `INSERT INTO payments
      ("patientNationalId", "patientPhone", "doctorId", "sessionId", "appointmentId", "amount", "paymentMethod", "notes", "medicalCenterId")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        patientNationalId || null,
        patientPhone || null,
        doctorId,
        sessionId,
        appointmentId,
        Number(amount),
        paymentMethod || null,
        notes || null,
        medicalCenterId
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true, payment: result.rows[0] });

  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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
