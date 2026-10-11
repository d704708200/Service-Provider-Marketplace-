# Backend Setup & Architecture Documentation

## Architecture Structure

```text
backend/
├── server.js                      # Application entry point, server startup & graceful shutdown
├── package.json                   # Dependencies and NPM test scripts
├── test_health.js                 # HTTP health and 404 middleware validation suite
├── test_models.js                 # Mongoose schema compilation and validation tests
├── test_auth_unit.js              # Password hashing, JWT & authorization unit tests
├── test_auth_http.js              # Auth endpoints HTTP input validation tests
├── test_auth_integration.js       # Live database end-to-end authentication integration tests
└── src/
    ├── app.js                     # Express application definition, middleware, routes
    ├── config/
    │   ├── db.js                  # Resilient Mongoose connection, status helper & disconnect
    │   └── cors.js                # Environment-aware CORS configuration
    ├── controllers/
    │   └── authController.js      # Auth request handlers (register, login, me)
    ├── middleware/
    │   ├── auth.js                # Bearer JWT authentication & role-based access control
    │   ├── errorHandler.js        # Centralized error handler & 404 notFoundHandler
    │   └── validation.js          # Authentication request input validation middleware
    ├── models/
    │   ├── index.js               # Barrel export for all 11 Mongoose models
    │   ├── User.js                # Core authentication identity model
    │   ├── Customer.js            # Customer profile & addresses model
    │   ├── Provider.js            # Provider profile, verification & ratings model
    │   ├── Category.js            # Service category model
    │   ├── Service.js             # Service catalog offering model
    │   ├── ServiceArea.js         # Geospatial service boundary model
    │   ├── Availability.js        # Provider weekly schedule & slot model
    │   ├── Booking.js             # Booking request & lifecycle model
    │   ├── Review.js              # Booking review & feedback model
    │   ├── Notification.js        # Notifications model
    │   └── Admin.js               # Admin RBAC model
    ├── services/
    │   └── authService.js         # Password hashing, profile creation, rollback & JWT login
    └── utils/
        └── jwt.js                 # Token signing & verification utilities
```

---

## Authentication & Authorization API Endpoints

All auth routes are prefixed under `/api/auth`:

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/customer` | Public | Registers a new Customer user and associated Customer profile. Prevents duplicate email/phone. |
| `POST` | `/api/auth/login/customer` | Public | Authenticates customer credentials, verifies `role === 'customer'`, returns JWT and profile. |
| `POST` | `/api/auth/register/provider` | Public | Registers a new Service Provider. Verification status is initialized as `pending`. |
| `POST` | `/api/auth/login/provider` | Public | Authenticates provider credentials, verifies `role === 'provider'`, returns JWT and profile. |
| `POST` | `/api/auth/login/admin` | Public | Authenticates admin credentials, checks `role === 'admin'` and verifies Admin record exists. |
| `GET` | `/api/auth/me` | Bearer Token | Returns authenticated user profile and associated role profile (Customer, Provider, or Admin). |

### Security Measures Implemented
- **Bcrypt Hashing**: Passwords hashed with 10 salt rounds prior to storage.
- **Credential Protection**: Password hashes and Mongoose internal version keys (`__v`) are stripped from all API outputs.
- **Generic Credential Errors**: Invalid login attempts respond with generic 401 messages to prevent user enumeration.
- **Strict Role Boundaries**: Tokens issued for customer cannot access provider/admin endpoints and vice versa.
- **Two-Step Creation Safety**: MongoDB transactions are used when replica sets are detected; compensating rollback deletes orphan User records if profile creation fails on standalone setups.
- **No Public Admin Creation**: Admin registration endpoint is strictly disallowed.

---

## Environment Variables

Configured in `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/service-provider-marketplace
JWT_SECRET=your-secure-jwt-secret-key-min-32-characters
JWT_EXPIRES_IN=7d
CUSTOMER_APP_URL=http://localhost:8081
PROVIDER_APP_URL=http://localhost:8081
ADMIN_PANEL_URL=http://localhost:5173
```

*Note: In production (`NODE_ENV=production`), startup rejects missing `JWT_SECRET`.*

---

## Running Verification Tests

From `backend` directory:
```bash
npm run test:models       # Validates all 11 Mongoose schemas and relationships
npm run test:health       # Tests /api/health and 404 middleware
npm run test:auth         # Tests bcrypt hashing, JWT issuance/expiry, role guards, and HTTP validation
npm run test:integration  # Runs live DB integration tests (requires active MONGODB_URI)
npm test                  # Runs full local test suite
```
