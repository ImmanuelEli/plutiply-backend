const { pool } = require('../config/database');

class Wallet {
  // Generate unique transaction reference
  static generateReference(prefix = 'TXN') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // Get user wallet balance
  static async getBalance(userId) {
    try {
      const result = await pool.query(
        'SELECT wallet_balance FROM users WHERE id = $1',
        [userId]
      );
      return result.rows.length > 0 ? parseFloat(result.rows[0].wallet_balance) : 0;
    } catch (error) {
      throw error;
    }
  }

  // Credit wallet (add money)
  static async credit(userId, amount, description, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current balance with row lock
      const userResult = await client.query(
        'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(userResult.rows[0].wallet_balance);
      const newBalance = currentBalance + parseFloat(amount);

      // Update user balance
      await client.query(
        'UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, userId]
      );

      // Create transaction record
      const reference = this.generateReference('CRD');
      const txnResult = await client.query(
        `INSERT INTO wallet_transactions 
        (user_id, transaction_type, amount, balance_before, balance_after, description, reference, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [userId, 'credit', amount, currentBalance, newBalance, description, reference, 'success', metadata]
      );

      // Create ledger entry (DR Float, CR User)
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, entry_type, debit_account, credit_account, amount, description)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [txnResult.rows[0].id, 'credit', 'float_account', `user_${userId}`, amount, description]
      );

      await client.query('COMMIT');
      return txnResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Debit wallet (remove money) - with negative balance prevention
  static async debit(userId, amount, description, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current balance with row lock
      const userResult = await client.query(
        'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(userResult.rows[0].wallet_balance);
      
      // Prevent negative balance
      if (currentBalance < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      const newBalance = currentBalance - parseFloat(amount);

      // Update user balance
      await client.query(
        'UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, userId]
      );

      // Create transaction record
      const reference = this.generateReference('DBT');
      const txnResult = await client.query(
        `INSERT INTO wallet_transactions 
        (user_id, transaction_type, amount, balance_before, balance_after, description, reference, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [userId, 'debit', amount, currentBalance, newBalance, description, reference, 'success', metadata]
      );

      // Create ledger entry (DR User, CR Float)
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, entry_type, debit_account, credit_account, amount, description)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [txnResult.rows[0].id, 'debit', `user_${userId}`, 'float_account', amount, description]
      );

      await client.query('COMMIT');
      return txnResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Internal transfer (User to User)
  static async transfer(senderId, receiverId, amount, description = 'Transfer') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Debit sender
      const senderResult = await client.query(
        'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [senderId]
      );

      if (senderResult.rows.length === 0) {
        throw new Error('Sender not found');
      }

      const senderBalance = parseFloat(senderResult.rows[0].wallet_balance);
      
      if (senderBalance < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      const senderNewBalance = senderBalance - parseFloat(amount);

      await client.query(
        'UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2',
        [senderNewBalance, senderId]
      );

      // Credit receiver
      const receiverResult = await client.query(
        'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [receiverId]
      );

      if (receiverResult.rows.length === 0) {
        throw new Error('Receiver not found');
      }

      const receiverBalance = parseFloat(receiverResult.rows[0].wallet_balance);
      const receiverNewBalance = receiverBalance + parseFloat(amount);

      await client.query(
        'UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2',
        [receiverNewBalance, receiverId]
      );

      // Create transaction reference
      const reference = this.generateReference('TRF');

      // Sender transaction record
      const senderTxn = await client.query(
        `INSERT INTO wallet_transactions 
        (user_id, transaction_type, amount, balance_before, balance_after, description, reference, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [senderId, 'transfer_out', amount, senderBalance, senderNewBalance, description, reference, 'success', { receiver_id: receiverId }]
      );

      // Receiver transaction record
      await client.query(
        `INSERT INTO wallet_transactions 
        (user_id, transaction_type, amount, balance_before, balance_after, description, reference, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [receiverId, 'transfer_in', amount, receiverBalance, receiverNewBalance, description, reference, 'success', { sender_id: senderId }]
      );

      // Ledger entry (DR Sender, CR Receiver)
      await client.query(
        `INSERT INTO ledger_entries (transaction_id, entry_type, debit_account, credit_account, amount, description)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [senderTxn.rows[0].id, 'transfer', `user_${senderId}`, `user_${receiverId}`, amount, description]
      );

      await client.query('COMMIT');
      return senderTxn.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get transaction history
  static async getTransactions(userId, limit = 20, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM wallet_transactions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get single transaction
  static async getTransaction(transactionId) {
    try {
      const result = await pool.query(
        'SELECT * FROM wallet_transactions WHERE id = $1',
        [transactionId]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Reverse transaction (for failed operations)
  static async reverseTransaction(transactionId, reason) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get original transaction
      const txnResult = await client.query(
        'SELECT * FROM wallet_transactions WHERE id = $1 FOR UPDATE',
        [transactionId]
      );

      if (txnResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const originalTxn = txnResult.rows[0];

      if (originalTxn.status === 'reversed') {
        throw new Error('Transaction already reversed');
      }

      // Mark original as reversed
      await client.query(
        'UPDATE wallet_transactions SET status = $1, updated_at = NOW() WHERE id = $2',
        ['reversed', transactionId]
      );

      // Reverse the balance change
      if (originalTxn.transaction_type === 'debit' || originalTxn.transaction_type === 'transfer_out') {
        // Credit back
        await this.credit(originalTxn.user_id, originalTxn.amount, `Reversal: ${reason}`, { reversed_transaction_id: transactionId });
      } else if (originalTxn.transaction_type === 'credit' || originalTxn.transaction_type === 'transfer_in') {
        // Debit back
        await this.debit(originalTxn.user_id, originalTxn.amount, `Reversal: ${reason}`, { reversed_transaction_id: transactionId });
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Wallet;