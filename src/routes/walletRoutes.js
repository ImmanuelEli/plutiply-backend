const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth');

// All wallet routes require authentication
router.use(authenticateToken);

// Get wallet balance
router.get('/balance', walletController.getBalance);

// Get transaction history
router.get('/transactions', walletController.getTransactions);

// Get single transaction details
router.get('/transactions/:transactionId', walletController.getTransactionDetails);

// Internal transfer (User to User)
router.post('/transfer', walletController.transfer);

// Fund wallet - Initiate payment
router.post('/fund', walletController.initiateFunding);

// Verify funding (webhook/callback)
router.post('/fund/verify', walletController.verifyFunding);

// Withdraw to Mobile Money
router.post('/withdraw', walletController.withdraw);

module.exports = router;