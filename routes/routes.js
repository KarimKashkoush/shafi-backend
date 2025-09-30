const express = require("express");
const router = express.Router();

const { registerUser, getUser, getAllUsers, updateUser } = require("../controllers/authController");
const { login } = require("../controllers/login");
const { addReport } = require("../controllers/addReport");
const { addResult } = require("../controllers/addResult");
const { staffAddResult } = require("../controllers/stafResult");
const { getFile } = require("../controllers/getFile");

const multer = require("multer");
const { addAppointment, addResultToAppointment, getAppointmentsWithResults } = require("../controllers/addAppointment");

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

// Auth
router.post("/register", registerUser);
router.post("/login", login);

// Users
router.get("/user/:id", getUser);
router.get("/allUsers", getAllUsers);
router.put("/user/:id", updateUser);

// Reports
router.post("/addReport", addReport);

// Results
router.post("/reports/:reportId/add-result", upload.array("resultFiles", 5), addResult);
router.post("/staffAddResult", upload.array("files", 5), staffAddResult);

// Files (عرض الملفات برابط مؤقت من S3)
router.get("/files/:key", getFile);


router.post("/appointments", addAppointment);
router.post("/appointments/:id/add-result", upload.array("files", 5), addResultToAppointment);
router.get("/appointments", getAppointmentsWithResults);

module.exports = router;
