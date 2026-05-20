const express = require('express');
const multer = require('multer');
const path = require('path');
const advisorCtrl = require('../controller/advisorController');
const authJwt = require('../middleware/authJwt');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage: storage });

router.use(authJwt);

router.get('/conversations', advisorCtrl.getConversations);
router.get('/experts', advisorCtrl.getAllAdvisors);
router.post('/conversations', advisorCtrl.initiateConversation);
router.get('/conversations/:conversationId/messages', advisorCtrl.getMessages);
router.post('/messages', advisorCtrl.sendMessage);
router.post('/upload', upload.single('file'), advisorCtrl.uploadFile);
router.post('/publications', advisorCtrl.createPublication);
router.get('/experts/:expertId/publications', advisorCtrl.getPublications);
router.delete('/publications/:id', advisorCtrl.deletePublication);

module.exports = router;
