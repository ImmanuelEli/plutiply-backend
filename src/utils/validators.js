const { body } = require('express-validator');

const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[0-9]{9,15}$/).withMessage('Please provide a valid phone number'),
  
  body('countryCode')
    .trim()
    .notEmpty().withMessage('Country code is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  body('referralCode')
    .optional()
    .trim()
];

const loginValidation = [
  body('emailOrPhone')
    .trim()
    .notEmpty().withMessage('Email or phone number is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

module.exports = { registerValidation, loginValidation };