const express = require("express");
const router = express.Router();

const { registerUser, getUser, getAllUsers, updateUser } = require("../controllers/authController");
const { login } = require("../controllers/login");
const { addReport } = require("../controllers/addReport");
const { addResult } = require("../controllers/addResult");
const { staffAddResult } = require("../controllers/stafResult");
const { getFile } = require("../controllers/getFile");
const { authenticateToken, requireRole, requireSelfOrRole } = require("../controllers/authenticateToken");

const multer = require("multer");
const { addAppointment, addResultToAppointment, getAppointmentsWithResults, deleteAppointment, updateNationalId } = require("../controllers/addAppointment");
const { checkExistingResult } = require("../controllers/checkExistingResult");
const { getAllResults } = require("../controllers/getResults");
const { getResultsByNationalId } = require("../controllers/getResultsByNationalId");

// Multer لتخزين الملفات في الذاكرة
const storage = multer.memoryStorage();
const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
                  cb(null, true);
            } else {
                  cb(new Error("نوع الملف غير مسموح. ارفع صور أو PDF فقط."), false);
            }
      },
});

/* ====================== Routes ====================== */

// ✅ Auth
router.post("/register", registerUser);
router.post("/login", login);

// ✅ Users
router.get("/user/:id", authenticateToken, requireSelfOrRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getUser);
router.get("/allUsers", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getAllUsers);
router.put("/user/:id", authenticateToken, requireSelfOrRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), updateUser);

// ✅ Appointments
router.post("/appointments", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), addAppointment);
router.get("/appointments", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getAppointmentsWithResults);
router.put("/appointments/:id/nationalId", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), updateNationalId);
router.delete("/appointments/:id", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), deleteAppointment);
router.post("/appointments/:id/addResultAppointment", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), upload.array("files", 5), addResultToAppointment);

// ✅ Reports & Results
router.post("/addReport", authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology'), addReport);
router.post("/reports/:reportId/addResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), upload.array("resultFiles", 5), addResult);
router.post("/staffAddResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), upload.array("files", 5), staffAddResult);
router.get("/results",authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getAllResults);
router.get("/results/nationalId/:nationalId",authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getResultsByNationalId);
// ✅ Files & Checks
router.get("/files/:key", authenticateToken, getFile);
router.get("/checkExistingResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), checkExistingResult);

module.exports = router;
