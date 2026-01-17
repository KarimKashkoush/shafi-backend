const express = require("express");
const router = express.Router();

const { registerUser, getUser, getAllUsers, updateUser, changePassword } = require("../controllers/authController");
const { login } = require("../controllers/login");
const { addReport } = require("../controllers/addReport");
const { addResult } = require("../controllers/addResult");
const { staffAddResult } = require("../controllers/stafResult");
const { getFile } = require("../controllers/getFile");
const { getAllDoctors } = require("../controllers/getAllDoctors");
const { authenticateToken, requireRole, requireSelfOrRole } = require("../controllers/authenticateToken");
const { addReceptionist, getReceptionists, updateReceptionistStatus, deleteReceptionist } = require('../controllers/receptionists');
const { addPayment, getPaymentsByMedicalCenter } = require("../controllers/payments");

const multer = require("multer");
const { addAppointment, addResultToAppointment, getAppointmentsWithResults, deleteAppointment, updateAppointment, getAppointmentById, getAppointmentsForDashboard, updateResultAppointment, getAppointmentsUser } = require("../controllers/addAppointment");
const { checkExistingResult } = require("../controllers/checkExistingResult");
const { getAllResults } = require("../controllers/getResults");
const { getResultsByNationalId } = require("../controllers/getResultsByNationalId");
const { addUserByAdmin, getAllStafByAdmin, getUserById, toggleUserStatus } = require("../controllers/manageUserByAdmin");
const { getPatientReports } = require("../controllers/doctorPatientReports");

// Multer لتخزين الملفات في الذاكرة
const storage = multer.memoryStorage();
const upload = multer({
      storage,
      limits: {
            fileSize: 100 * 1024 * 1024 // ✅ 100MB (غيّرها حسب احتياجك)
      },
      fileFilter: (req, file, cb) => {
            // صور
            if (file.mimetype.startsWith("image/")) {
                  return cb(null, true);
            }

            // PDF
            if (file.mimetype === "application/pdf") {
                  return cb(null, true);
            }

            // ✅ فيديوهات
            if (
                  file.mimetype === "video/mp4" ||
                  file.mimetype === "video/webm" ||
                  file.mimetype === "video/ogg"
            ) {
                  return cb(null, true);
            }

            cb(
                  new Error("نوع الملف غير مسموح. ارفع صور أو PDF أو فيديو فقط."),
                  false
            );
      },
});


/* ====================== Routes ====================== */
// ✅ Auth
router.post("/register", registerUser);
router.post("/login", login);

// ✅ Users
router.get("/user/:id", authenticateToken, requireSelfOrRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getUser);
router.get("/allUsers", getAllUsers);
router.put("/user/:id", authenticateToken, requireSelfOrRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), updateUser);
router.put("/users/:id/change-password", changePassword);

// ✅ Appointments
router.post("/appointments", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), addAppointment);
router.get("/appointments", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), getAppointmentsWithResults);
router.get("/getAppointmentsForDashboard/:id", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), getAppointmentsForDashboard);
router.get("/appointment/:id", getAppointmentById);
router.put("/appointments/:id", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), updateAppointment);
router.delete("/appointments/:id", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), deleteAppointment);
router.post("/appointments/:id/addResultAppointment", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology', 'receptionist', 'medicalCenter'), upload.array("files", 5), addResultToAppointment);
router.put("/appointments/:id/updateResultAppointment/:reportId", authenticateToken, requireRole('medicalCenter'), upload.array("files", 5), updateResultAppointment);

// ✅ Reports & Results
router.post("/addReport", authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology'), addReport);
router.post("/reports/:reportId/addResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), upload.array("resultFiles", 5), addResult);
router.post("/staffAddResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), upload.array("files", 5), staffAddResult);
router.get("/results", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getAllResults);
router.get("/results/nationalId/:nationalId", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), getResultsByNationalId);

// ✅ Files & Checks
router.get("/files/:key", authenticateToken, getFile);
router.get("/checkExistingResult", authenticateToken, requireRole('patient', 'doctor', 'pharmacist', 'lab', 'radiology'), checkExistingResult);

// receptionists
router.post('/addReceptionists', authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology', 'medicalCenter'), addReceptionist);
router.get('/getReceptionists', authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology', 'medicalCenter'), getReceptionists);
router.patch('/updateReceptionistStatus/:id', authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology', 'medicalCenter'), updateReceptionistStatus);
router.delete('/deleteReceptionist/:id', authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology', 'medicalCenter'), deleteReceptionist);

// Admin - Add User
router.post("/addUserByAdmin", authenticateToken, requireRole('admin'), addUserByAdmin);
router.get("/getAllStafByAdmin", authenticateToken, requireRole('admin'), getAllStafByAdmin);
router.put("/toggleUserStatus/:id", authenticateToken, requireRole('admin'), toggleUserStatus);
router.post("/getUserById", authenticateToken, requireRole('admin'), getUserById);

// Payments
router.post("/addPayment", authenticateToken, addPayment);
// فرضًا عندك authenticateToken و requireRole جاهزين
router.get(
      "/getPaymentsByMedicalCenter/:medicalCenterId",
      authenticateToken,
      requireRole("doctor", "admin", "medicalCenter"),
      getPaymentsByMedicalCenter
);

router.get("/doctor/patientFiles/:identifier", getPatientReports);



// Doctors
router.get("/doctors", authenticateToken, requireRole('doctor', 'pharmacist', 'lab', 'radiology', 'radiology_reception'), getAllDoctors);


const { getS3Usage } = require("../controllers/s3Size");
const { getRDSUsage } = require("../controllers/databaseSize");
router.get("/s3-usage", getS3Usage);
router.get("/getRDSUsage", getRDSUsage);


module.exports = router;

