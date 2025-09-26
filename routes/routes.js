const express = require('express');
const router = express.Router();
const { registerUser, getUser, getAllUsers, updateUser } = require('../controllers/authController');
const { login } = require('../controllers/login');
const { addReport } = require('../controllers/addReport');
const { addResult } = require('../controllers/addResult');
const multer = require('multer');

router.post('/register', registerUser);
router.post('/login', login);

router.post('/addReport', addReport);

// Multer لتخزين الملفات في الذاكرة
const storage = multer.memoryStorage();
const upload = multer({
      storage: storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") cb(null, true);
            else cb(new Error("نوع الملف غير مسموح. ارفع صور أو PDF فقط."), false);
      },
});

router.post("/reports/:reportId/add-result", upload.array("resultFiles", 5), addResult);

router.get('/user/:id', getUser)
router.get('/allUsers', getAllUsers)

router.put('/user/:id', updateUser);

module.exports = router;
