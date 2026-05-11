const express = require('express');
const advisorCtrl = require('../controller/advisorController');
const authJwt = require('../middleware/authJwt');

const router = express.Router();

router.use(authJwt);

router.get('/conversations', advisorCtrl.getConversations);
router.get('/experts', advisorCtrl.getAllAdvisors);
router.post('/conversations', advisorCtrl.initiateConversation);
router.get('/conversations/:conversationId/messages', advisorCtrl.getMessages);
router.post('/messages', advisorCtrl.sendMessage);

module.exports = router;
