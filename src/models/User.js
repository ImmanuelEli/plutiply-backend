const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Generate unique referral code
  static generateReferralCode() {
    return 'PLU' + Math.random().toString(36).substring(2, 9).toUpperCase();
  }

  // Create new user
  static async create(userData) {
    const { fullName, email, phoneNumber, countryCode, password, referredBy } = userData;
    
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      // Generate referral code
      const referralCode = this.generateReferralCode();
      
      // Check if referred by code exists
      let referrerId = null;
      if (referredBy) {
        const referrerResult = await pool.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referredBy]
        );
        if (referrerResult.rows.length > 0) {
          referrerId = referrerResult.rows[0].id;
        }
      }
      
      const query = `
        INSERT INTO users (full_name, email, phone_number, country_code, password_hash, referral_code, referred_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, full_name, email, phone_number, country_code, referral_code, wallet_balance, created_at
      `;
      
      const values = [fullName, email, phoneNumber, countryCode, passwordHash, referralCode, referrerId];
      const result = await pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by email or phone
  static async findByEmailOrPhone(emailOrPhone) {
    try {
      const query = `
        SELECT * FROM users 
        WHERE email = $1 OR phone_number = $1
      `;
      const result = await pool.query(query, [emailOrPhone]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Check if email exists
  static async emailExists(email) {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    return result.rows.length > 0;
  }

  // Check if phone exists
  static async phoneExists(phone) {
    const result = await pool.query('SELECT id FROM users WHERE phone_number = $1', [phone]);
    return result.rows.length > 0;
  }
}

module.exports = User;