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
