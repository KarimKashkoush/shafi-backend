const pool = require("../db");

const getAllDoctors = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id AS "doctorId",
        u."fullName",
        u.email,
        u."phoneNumber",
        d.specialty
      FROM doctors d
      JOIN users u ON d."userId" = u.id
      WHERE u.role = 'doctor';
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getAllDoctors };
