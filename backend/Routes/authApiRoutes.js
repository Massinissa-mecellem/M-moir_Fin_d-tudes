const express = require('express');
const authJwt = require('../middleware/authJwt');
const authCtrl = require('../controller/authController');

const router = express.Router();

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.get('/me', authJwt, authCtrl.getMe);
router.patch('/me', authJwt, authCtrl.patchMe);

module.exports = router;
