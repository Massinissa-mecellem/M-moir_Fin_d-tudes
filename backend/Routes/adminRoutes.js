const express = require('express');
const router = express.Router();
const adminController = require('../controller/adminController');
const adminAuth = require('../middleware/adminAuth');

// Toutes les routes ici nécessitent d'être admin
router.use(adminAuth);

// Routes utilisateurs
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Routes statistiques / GEE
router.get('/stats', adminController.getSystemStats);

module.exports = router;
