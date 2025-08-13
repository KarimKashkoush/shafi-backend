const express = require('express');
const router = express.Router();
const { registerUser, getAllUsers, getUser, updateUser } = require('../controllers/authController');
const { login } = require('../controllers/login');
const { addReport } = require('../controllers/addReport');
const authenticateToken = require('../controllers/authenticateToken');
const { addResult } = require('../controllers/addResult');
const upload = require('../middleware/upload');


router.post('/register', registerUser);
router.post('/login', login);

router.post('/addReport', addReport);
router.post("/reports/:reportId/add-result", upload.array("resultFiles"), addResult);router.get('/allUsers', getAllUsers)
router.get('/user/:id', getUser)

router.put('/user/:id', updateUser);

module.exports = router;
