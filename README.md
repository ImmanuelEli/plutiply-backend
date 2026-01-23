# Plutiply Backend API

Digital transaction platform backend built with Node.js, Express, and PostgreSQL.

## Features
- ✅ User Authentication (Register/Login with JWT)
- ✅ Transaction PIN System
- ✅ PostgreSQL Database
- ✅ Referral System Structure
- 🚧 Wallet Management (In Progress)
- 🚧 Payment Integration (Coming Soon)
- 🚧 Services Integration (Coming Soon)

## Tech Stack
- Node.js + Express
- PostgreSQL
- JWT Authentication
- Bcrypt for password/PIN hashing

## Setup Instructions

### Prerequisites
- Node.js v20+
- PostgreSQL 15+

### Installation
1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/plutiply-backend.git
cd plutiply-backend
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=plutiply
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_secret_key
SESSION_EXPIRY=7d

FRONTEND_URL=http://127.0.0.1:5500
```

4. Create database
```sql
CREATE DATABASE plutiply;
```

5. Run the server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (protected)

### PIN Management
- `GET /api/pin/status` - Check if user has PIN (protected)
- `POST /api/pin/create` - Create transaction PIN (protected)
- `POST /api/pin/verify` - Verify PIN (protected)
- `PUT /api/pin/change` - Change PIN (protected)
- `POST /api/pin/reset` - Reset PIN with password (protected)

### Health Check
- `GET /api/health` - Check API status

## Database Schema
- users
- transactions
- wallet_transactions
- referrals
- services
- pricing
- admins

## Development
```bash
npm run dev  # Start with nodemon
npm start    # Start production
```

## Team
- Backend Developer: Elikplim
- Frontend Developer: Stanleyss