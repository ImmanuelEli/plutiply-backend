const User = require('../models/User');
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

// Create/Set Transaction PIN
exports.createPin = async (req, res) => {
  try {
    const { pin, confirmPin } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!pin || !confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'PIN and confirmation are required'
      });
    }

    if (pin !== confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'PINs do not match'
      });
    }

    // PIN must be 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Check if user already has a PIN
    const user = await User.findById(userId);
    if (user.transaction_pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN already set. Use change PIN to update.'
      });
    }

    // Hash PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    // Save PIN
    await pool.query(
      'UPDATE users SET transaction_pin = $1 WHERE id = $2',
      [pinHash, userId]
    );

    res.json({
      success: true,
      message: 'Transaction PIN created successfully'
    });

  } catch (error) {
    console.error('Create PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create PIN'
    });
  }
};

// Verify Transaction PIN
exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const userId = req.user.userId;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required'
      });
    }

    // Get user
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.rows[0];

    // Check if PIN is set
    if (!userData.transaction_pin) {
      return res.status(400).json({
        success: false,
        message: 'No PIN set. Please create a PIN first.'
      });
    }

    // Check if PIN is locked
    if (userData.pin_locked_until && new Date(userData.pin_locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(userData.pin_locked_until) - new Date()) / 60000);
      return res.status(403).json({
        success: false,
        message: `PIN locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, userData.transaction_pin);

    if (!isValid) {
      // Increment failed attempts
      const attempts = userData.pin_attempts + 1;
      
      // Lock PIN after 3 failed attempts for 15 minutes
      if (attempts >= 3) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await pool.query(
          'UPDATE users SET pin_attempts = $1, pin_locked_until = $2 WHERE id = $3',
          [attempts, lockUntil, userId]
        );
        
        return res.status(403).json({
          success: false,
          message: 'Too many failed attempts. PIN locked for 15 minutes.'
        });
      }

      await pool.query(
        'UPDATE users SET pin_attempts = $1 WHERE id = $2',
        [attempts, userId]
      );

      return res.status(401).json({
        success: false,
        message: `Invalid PIN. ${3 - attempts} attempts remaining.`
      });
    }

    // Reset attempts on successful verification
    await pool.query(
      'UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'PIN verified successfully'
    });

  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify PIN'
    });
  }
};

// Change Transaction PIN
exports.changePin = async (req, res) => {
  try {
    const { oldPin, newPin, confirmNewPin } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!oldPin || !newPin || !confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPin !== confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'New PINs do not match'
      });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Get user
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.rows[0];

    if (!userData.transaction_pin) {
      return res.status(400).json({
        success: false,
        message: 'No PIN set. Use create PIN endpoint.'
      });
    }

    // Verify old PIN
    const isValid = await bcrypt.compare(oldPin, userData.transaction_pin);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid current PIN'
      });
    }

    // Hash new PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(newPin, salt);

    // Update PIN
    await pool.query(
      'UPDATE users SET transaction_pin = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = $2',
      [pinHash, userId]
    );

    res.json({
      success: true,
      message: 'PIN changed successfully'
    });

  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change PIN'
    });
  }
};

// Reset PIN (requires password)
exports.resetPin = async (req, res) => {
  try {
    const { password, newPin, confirmNewPin } = req.body;
    const userId = req.user.userId;

    if (!password || !newPin || !confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPin !== confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'New PINs do not match'
      });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Get user
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Hash new PIN
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(newPin, salt);

    // Update PIN
    await pool.query(
      'UPDATE users SET transaction_pin = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = $2',
      [pinHash, userId]
    );

    res.json({
      success: true,
      message: 'PIN reset successfully'
    });

  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset PIN'
    });
  }
};

// Check if user has PIN
exports.checkPinStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await pool.query(
      'SELECT transaction_pin FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      hasPin: !!user.rows[0].transaction_pin
    });

  } catch (error) {
    console.error('Check PIN status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PIN status'
    });
  }
};