# Backend Setup & Architecture Documentation

## Architecture Structure

```text
backend/
├── server.js                      # Application entry point, server startup & graceful shutdown
├── package.json                   # Dependencies and NPM scripts
├── test_health.js                 # HTTP health and 404 middleware validation suite
├── test_models.js                 # Mongoose schema compilation and validation tests
└── src/
    ├── app.js                     # Express application definition, middleware, base routes
    ├── config/
    │   ├── db.js                  # Resilient Mongoose connection, status helper & disconnect
    │   └── cors.js                # Environment-aware CORS configuration
    ├── middleware/
    │   └── errorHandler.js        # Centralized error handler & 404 notFoundHandler
    └── models/
        ├── index.js               # Barrel export for all Mongoose models
        ├── User.js                # Core authentication identity model
        ├── Customer.js            # Customer profile & addresses model
        ├── Provider.js            # Provider profile, verification & ratings model
        ├── Category.js            # Service category model
        ├── Service.js             # Service catalog offering model
        ├── ServiceArea.js         # Geospatial service boundary model
        ├── Availability.js        # Provider weekly schedule & slot model
        ├── Booking.js             # Booking request & lifecycle model
        ├── Review.js              # Booking review & feedback model
        ├── Notification.js        # Notifications model
        └── Admin.js               # Admin RBAC model
```

## Quick Start

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set `MONGODB_URI`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/service-provider-marketplace
   ```
   *Note: If `MONGODB_URI` is omitted, the server still boots and reports database as `disconnected` in `/api/health` without crashing.*

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Run in production mode**:
   ```bash
   npm start
   ```

5. **Run test suite**:
   ```bash
   npm test
   ```
