const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Create tables if they don't exist
const createTables = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone_number VARCHAR(20) UNIQUE NOT NULL,
      country_code VARCHAR(10) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      transaction_pin VARCHAR(255),
      pin_attempts INT DEFAULT 0,
      pin_locked_until TIMESTAMP,
      referral_code VARCHAR(20) UNIQUE NOT NULL,
      referred_by UUID REFERENCES users(id),
      wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
      is_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTransactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      service_provider VARCHAR(100),
      recipient VARCHAR(255),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createWalletTransactionsTable = `
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      balance_after DECIMAL(10, 2) NOT NULL,
      description TEXT,
      reference VARCHAR(100) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createReferralsTable = `
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      commission_earned DECIMAL(10, 2) DEFAULT 0.00,
      transaction_id UUID REFERENCES transactions(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const createServicesTable = `
    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_type VARCHAR(50) NOT NULL,
      provider VARCHAR(100) NOT NULL,
      service_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPricingTable = `
    CREATE TABLE IF NOT EXISTS pricing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID REFERENCES services(id) ON DELETE CASCADE,
      package_name VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      discount_amount DECIMAL(10, 2) DEFAULT 0.00,
      validity_period VARCHAR(50),
      data_volume VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createAdminTable = `
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(createUsersTable);
    await pool.query(createTransactionsTable);
    await pool.query(createWalletTransactionsTable);
    await pool.query(createReferralsTable);
    await pool.query(createServicesTable);
    await pool.query(createPricingTable);
    await pool.query(createAdminTable);
    console.log('✅ All database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  }
};

module.exports = { pool, createTables };