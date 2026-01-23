const express = require('express');
const router = express.Router();
const pinController = require('../controllers/pinController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.post('/create', authenticateToken, pinController.createPin);
router.post('/verify', authenticateToken, pinController.verifyPin);
router.put('/change', authenticateToken, pinController.changePin);
router.post('/reset', authenticateToken, pinController.resetPin);
router.get('/status', authenticateToken, pinController.checkPinStatus);

module.exports = router;