# Project Setup & Configuration

## Prerequisites
- Node.js (v18 or newer)
- npm (v9 or newer)
- MongoDB instance (MongoDB Atlas URI or local MongoDB Community server)

## Installation

To install dependencies across all workspaces:
```bash
npm run install:all
```

Or individually:
```bash
cd backend && npm install
cd ../customer-app && npm install
cd ../provider-app && npm install
cd ../admin-panel && npm install
```

## Environment Configuration

### 1. Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` and update values:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/service-provider-marketplace
JWT_SECRET=replace_with_your_strong_secret_key
JWT_EXPIRES_IN=7d
CUSTOMER_APP_URL=http://localhost:8081
PROVIDER_APP_URL=http://localhost:8081
ADMIN_PANEL_URL=http://localhost:5173
```

### 2. Mobile Applications
- `customer-app/.env`: `EXPO_PUBLIC_API_URL=http://localhost:5000/api`
- `provider-app/.env`: `EXPO_PUBLIC_API_URL=http://localhost:5000/api`

### 3. Admin Panel
- `admin-panel/.env`: `VITE_API_URL=http://localhost:5000/api`

Run the admin panel locally:
```bash
cd admin-panel
npm run dev
```

For complete architecture, routing, and verification details, see [ADMIN_PANEL.md](./ADMIN_PANEL.md).

## Running Tests
Run backend test suite:
```bash
cd backend
npm test
```

### Live Database Integration Tests
When `MONGODB_URI` and `JWT_SECRET` are configured in `backend/.env`, run the end-to-end database tests:
```bash
cd backend
npm test                  # Core unit tests (models, health check, auth)
npm run test:integration  # User authentication integration tests
npm run test:categories   # Category taxonomy integration tests
npm run test:services     # Services catalog integration tests
npm run test:providers    # Provider management & verification tests
```
This tests:
- Customer registration and login
- Duplicate registration rejection (409)
- Invalid password handling (401)
- Provider registration (pending status) and login
- Role mismatch access controls (403)
- Admin login and profile association
- Token verification with `GET /api/auth/me`
- Deactivated / inactive account blocking (403)
- Safe, automated teardown of test-created records

## Safe Administrator Provisioning

To provision an authorized administrator account without hardcoding credentials:

### Method 1: Interactive Prompt
```bash
cd backend
npm run seed:admin
```
You will be securely prompted for the administrator's email and initial password (minimum 6 characters).

### Method 2: Command Line Flags
```bash
cd backend
node src/seeds/provisionAdmin.js --email=admin@example.com --password="YourSecurePassword" --name="Platform Administrator" --department="Operations"
```

### Method 3: Environment Variables
Define the following in `backend/.env`:
```env
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=YourSecurePassword
ADMIN_SEED_NAME="Platform Administrator"
ADMIN_SEED_DEPARTMENT="Operations"
```
Then run:
```bash
cd backend
npm run seed:admin
```

**Safety Guarantees:**
- Passwords are securely hashed with bcrypt (salt rounds = 10) before storage; plaintext passwords are never stored or logged.
- The script checks for existing accounts and refuses to overwrite passwords or re-assign accounts with conflicting roles.
- Safe to re-run; will not create duplicate entries or delete existing accounts.
- Creates both the primary `User` record (role `admin`) and the associated `Admin` profile record required by `/api/auth/login/admin`.
