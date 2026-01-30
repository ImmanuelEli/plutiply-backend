const Wallet = require('../models/Wallet');
const User = require('../models/User');
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

// Get wallet balance
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.userId;
    const balance = await Wallet.getBalance(userId);

    res.json({
      success: true,
      data: {
        balance: parseFloat(balance).toFixed(2),
        currency: 'GHS'
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance'
    });
  }
};

// Get transaction history
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const transactions = await Wallet.getTransactions(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: transactions.map(txn => ({
        id: txn.id,
        type: txn.transaction_type,
        amount: parseFloat(txn.amount).toFixed(2),
        balanceBefore: parseFloat(txn.balance_before).toFixed(2),
        balanceAfter: parseFloat(txn.balance_after).toFixed(2),
        description: txn.description,
        reference: txn.reference,
        status: txn.status,
        createdAt: txn.created_at
      }))
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};

// Internal transfer (User to User)
exports.transfer = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientPhone, amount, pin, description } = req.body;

    // Validation
    if (!recipientPhone || !amount || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Recipient phone, amount, and PIN are required'
      });
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Verify sender's PIN
    const sender = await pool.query('SELECT * FROM users WHERE id = $1', [senderId]);
    if (!sender.rows[0].transaction_pin) {
      return res.status(400).json({
        success: false,
        message: 'Please set up your transaction PIN first'
      });
    }

    const pinValid = await bcrypt.compare(pin, sender.rows[0].transaction_pin);
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // Find recipient by phone
    const recipient = await pool.query(
      'SELECT id, full_name FROM users WHERE phone_number = $1',
      [recipientPhone]
    );

    if (recipient.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    const receiverId = recipient.rows[0].id;

    // Can't transfer to self
    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }

    // Execute transfer
    const transaction = await Wallet.transfer(
      senderId,
      receiverId,
      transferAmount,
      description || `Transfer to ${recipient.rows[0].full_name}`
    );

    res.json({
      success: true,
      message: 'Transfer successful',
      data: {
        transactionId: transaction.id,
        reference: transaction.reference,
        amount: parseFloat(transaction.amount).toFixed(2),
        recipient: recipient.rows[0].full_name,
        balanceAfter: parseFloat(transaction.balance_after).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Transfer error:', error);
    
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Transfer failed'
    });
  }
};

// Fund wallet - Initialize payment (Paystack integration coming)
exports.initiateFunding = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const fundingAmount = parseFloat(amount);

    // Generate payment reference
    const reference = Wallet.generateReference('FUND');

    // Create pending wallet transaction
    const result = await pool.query(
      `INSERT INTO wallet_transactions 
      (user_id, transaction_type, amount, balance_before, balance_after, description, reference, status, payment_method, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        'funding',
        fundingAmount,
        await Wallet.getBalance(userId),
        await Wallet.getBalance(userId), // Same until confirmed
        'Wallet funding',
        reference,
        'pending',
        paymentMethod || 'momo',
        { initiated_at: new Date() }
      ]
    );

    // TODO: Call Paystack API to initialize payment
    // For now, return mock payment URL

    res.json({
      success: true,
      message: 'Payment initiated',
      data: {
        reference: reference,
        amount: fundingAmount.toFixed(2),
        paymentUrl: `https://checkout.paystack.com/${reference}`, // Mock URL
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Initiate funding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment'
    });
  }
};

// Verify funding (Webhook/callback handler)
exports.verifyFunding = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required'
      });
    }

    // Get pending transaction
    const txnResult = await pool.query(
      'SELECT * FROM wallet_transactions WHERE reference = $1 AND status = $2',
      [reference, 'pending']
    );

    if (txnResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already processed'
      });
    }

    const transaction = txnResult.rows[0];

    // TODO: Verify payment with Paystack API
    // For now, assume payment successful

    // Credit user wallet
    await Wallet.credit(
      transaction.user_id,
      transaction.amount,
      'Wallet funded via Mobile Money',
      { payment_reference: reference, payment_method: 'momo' }
    );

    // Update original pending transaction
    await pool.query(
      'UPDATE wallet_transactions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['success', transaction.id]
    );

    res.json({
      success: true,
      message: 'Wallet funded successfully',
      data: {
        amount: parseFloat(transaction.amount).toFixed(2),
        newBalance: (await Wallet.getBalance(transaction.user_id)).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Verify funding error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
};

// Withdraw to Mobile Money
exports.withdraw = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, momoNumber, pin } = req.body;

    // Validation
    if (!amount || !momoNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Amount, mobile money number, and PIN are required'
      });
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Minimum withdrawal amount
    if (withdrawAmount < 5) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is GHS 5.00'
      });
    }

    // Verify PIN
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user.rows[0].transaction_pin) {
      return res.status(400).json({
        success: false,
        message: 'Please set up your transaction PIN first'
      });
    }

    const pinValid = await bcrypt.compare(pin, user.rows[0].transaction_pin);
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // Check balance
    const balance = await Wallet.getBalance(userId);
    if (balance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Debit wallet
    const transaction = await Wallet.debit(
      userId,
      withdrawAmount,
      `Withdrawal to ${momoNumber}`,
      { momo_number: momoNumber, withdrawal_initiated: new Date() }
    );

    // TODO: Call Paystack/Aggregator disbursement API
    // For now, mark as pending

    await pool.query(
      'UPDATE wallet_transactions SET status = $1 WHERE id = $2',
      ['pending', transaction.id]
    );

    res.json({
      success: true,
      message: 'Withdrawal initiated',
      data: {
        transactionId: transaction.id,
        reference: transaction.reference,
        amount: parseFloat(transaction.amount).toFixed(2),
        momoNumber: momoNumber,
        status: 'pending',
        balanceAfter: parseFloat(transaction.balance_after).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Withdrawal failed'
    });
  }
};

// Get single transaction details
exports.getTransactionDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    const transaction = await Wallet.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Verify transaction belongs to user
    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    res.json({
      success: true,
      data: {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: parseFloat(transaction.amount).toFixed(2),
        balanceBefore: parseFloat(transaction.balance_before).toFixed(2),
        balanceAfter: parseFloat(transaction.balance_after).toFixed(2),
        description: transaction.description,
        reference: transaction.reference,
        status: transaction.status,
        paymentMethod: transaction.payment_method,
        metadata: transaction.metadata,
        createdAt: transaction.created_at
      }
    });
  } catch (error) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction'
    });
  }
};