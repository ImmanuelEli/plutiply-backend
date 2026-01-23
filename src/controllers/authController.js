const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.SESSION_EXPIRY || '7d'
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { fullName, email, phoneNumber, countryCode, password, referralCode } = req.body;

    // Check if email already exists
    if (await User.emailExists(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Check if phone already exists
    if (await User.phoneExists(phoneNumber)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already registered' 
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      phoneNumber,
      countryCode,
      password,
      referredBy: referralCode || null
    });

    // Generate token
    const token = generateToken(user.id);

    // In login function, update the response:
    res.json({
      success: true,
       message: 'Login successful',
       data: {
       user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phone_number,
        referralCode: user.referral_code,
        walletBalance: user.wallet_balance
      },
      token
      }
        });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed. Please try again.' 
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { emailOrPhone, password } = req.body;

    // Find user
    const user = await User.findByEmailOrPhone(emailOrPhone);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is disabled. Contact support.' 
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phone_number,
          referralCode: user.referral_code,
          walletBalance: user.wallet_balance
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed. Please try again.' 
    });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phone_number,
        countryCode: user.country_code,
        referralCode: user.referral_code,
        walletBalance: user.wallet_balance,
        isVerified: user.is_verified,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch profile' 
    });
  }
};