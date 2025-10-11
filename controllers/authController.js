const pool = require('../db');
const bcrypt = require('bcryptjs');

// Register User
async function registerUser(req, res) {
  const {
    firstName,
    fullName,
    email,
    phoneNumber,
    password,
    pin,
    role,
    gender,
    nationalId, // ✅ الرقم القومي الجديد
  } = req.body;

  try {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR "phoneNumber" = $2 OR "nationalId" = $3',
      [email || null, phoneNumber || null, nationalId || null]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'الحساب موجود بالفعل' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `INSERT INTO users ("firstName", "fullName", email, "phoneNumber", password, pin, role, gender, "nationalId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, "firstName", "fullName", email, "phoneNumber", "nationalId", role, gender`,
      [firstName, fullName, email, phoneNumber, hashedPassword, pin, role, gender, nationalId]
    );

    res.status(201).json({ message: 'success', user: newUser.rows[0] });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: 'error', error: err.message });
  }
}



// Get All Users
async function getAllUsers(req, res) {
      try {
            const result = await pool.query('SELECT * FROM users');
            res.status(200).json({
                  message: "success",
                  users: result.rows
            });
      } catch (error) {
            console.error("Database error:", error);
            res.status(500).json({ message: "حدث خطأ في السيرفر", error: error.message });
      }
}

// Get one User + Reports
async function getUser(req, res) {
      const { id } = req.params;
      try {
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
            if (userResult.rows.length === 0) {
                  return res.status(404).json({ message: 'المريض غير موجود' });
            }
            const user = userResult.rows[0];

            const reportsResult = await pool.query(
                  'SELECT * FROM reports WHERE "userId" = $1 ORDER BY "createdAt" DESC',
                  [id]
            );

            res.json({ user, reports: reportsResult.rows });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'خطأ في السيرفر' });
      }
}

// Update User
async function updateUser(req, res) {
      const { id } = req.params;
      const fields = req.body;

      const columnMap = {
            firstname: "firstName",
            fullname: "fullName",
            phonenumber: "phoneNumber",
            email: "email",
            gender: "gender",
            blood: "blood",
            emergencynumber: "emergencyNumber",
            address: "address",
            birthdate: "birthDate"
      };

      try {
            if (!fields || Object.keys(fields).length === 0) {
                  return res.status(400).json({ message: "مفيش بيانات لتحديثها" });
            }

            // التحقق من الحقول الإلزامية
            if (
                  ("firstname" in fields && fields.firstname === "")
            ) {
                  return res
                        .status(400)
                        .json({ message: "الاسم ورقم الهاتف والايميل لازم يكونوا قيم مش فاضية" });
            }

            const setClauses = [];
            const values = [];
            let index = 1;

            for (const [key, value] of Object.entries(fields)) {
                  const column = columnMap[key.toLowerCase()];
                  if (column) {
                        // لو القيمة فاضية نخليها NULL
                        const safeValue = value === "" ? null : value;

                        setClauses.push(`"${column}" = $${index}`);
                        values.push(safeValue);
                        index++;
                  }
            }

            if (setClauses.length === 0) {
                  return res
                        .status(400)
                        .json({ message: "مفيش بيانات متوافقة للتحديث" });
            }

            values.push(id);

            const query = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING 
        id,
        "firstName",
        "fullName",
        "phoneNumber",
        email,
        gender,
        blood,
        "emergencyNumber",
        address,
        "birthDate"
    `;

            const updateResult = await pool.query(query, values);

            if (updateResult.rows.length === 0) {
                  return res.status(404).json({ message: "المستخدم غير موجود" });
            }

            res.json({ message: "success", user: updateResult.rows[0] });
      } catch (error) {
            console.error(error);
            res.status(500).json({ message: "خطأ في السيرفر" });
      }
}

module.exports = { registerUser, getAllUsers, getUser, updateUser };
