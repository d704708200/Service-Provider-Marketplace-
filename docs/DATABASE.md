# Database Architecture & Models Documentation

## Overview
The Service Provider Marketplace backend uses **MongoDB** with **Mongoose ODM (v8.3.0)**.
The database schema supports multi-role users (Customer, Provider, Admin), hierarchical categories, localized services, geo-indexed service areas, scheduling/availability, end-to-end booking lifecycle, ratings/reviews, and notifications.

---

## Configuration & Connection

- **Connection file**: `backend/src/config/db.js`
- **Environment Variable**: `MONGODB_URI`
  - Example: `mongodb://localhost:27017/service-provider-marketplace` or MongoDB Atlas URI `mongodb+srv://<user>:<password>@cluster0.mongodb.net/service-marketplace?retryWrites=true&w=majority`
- **Connection behavior**:
  - Automatically times out in 5 seconds if MongoDB is unreachable (`serverSelectionTimeoutMS: 5000`).
  - Does not crash the API server if MongoDB is offline or unconfigured; the server continues running and reports `"database": { "status": "disconnected", "connected": false }` on the health check endpoint.
  - Automatically registers graceful shutdown handlers (`SIGINT`, `SIGTERM`) to cleanly disconnect Mongoose connections.

---

## Health Check Endpoint

- **Route**: `GET /api/health`
- **Response Format**:
```json
{
  "success": true,
  "message": "Service Provider Marketplace API is running",
  "timestamp": "2026-10-11T13:16:40.882Z",
  "uptime": 3,
  "database": {
    "status": "connected" | "disconnected",
    "connected": true | false,
    "host": "localhost" | null,
    "name": "service-provider-marketplace" | null
  },
  "environment": "development"
}
```

---

## Mongoose Models Summary

| Model | Collection | Primary Keys & References | Key Indexes | Description |
| :--- | :--- | :--- | :--- | :--- |
| **User** | `users` | `_id` | `email` (unique), `phone` (unique), `role`, `isActive` | Core authentication and identity profile for all roles. |
| **Customer** | `customers` | `_id`, `user` (ref: `User`, unique) | `user`, `addresses.location` (`2dsphere`) | Customer profile with multiple saved GeoJSON addresses and payment preferences. |
| **Provider** | `providers` | `_id`, `user` (ref: `User`, unique), `categories`, `serviceAreas` | `user`, `verificationStatus`, `isAvailable`, `categories`, `rating.average` | Service professional profile, credentials, verification status, and ratings. |
| **Category** | `categories` | `_id` | `name` (unique), `slug` (unique), `isActive`, `displayOrder` | Service categories with unique slug resolution and Service reference protection. |
| **Service** | `services` | `_id`, `category` (ref: `Category`), `provider` (ref: `Provider`, optional) | `category`, `provider`, `price`, `isActive` | Catalog service items with pricing model (fixed/hourly/quote) referencing Category. |
| **ServiceArea** | `serviceareas` | `_id` | `city`, `zipCodes`, `polygon` (`2dsphere`) | Geographic boundary / serviced zone with GeoJSON Polygon support. |
| **Availability** | `availabilities`| `_id`, `provider` (ref: `Provider`) | Compound unique index: `{ provider: 1, dayOfWeek: 1 }` | Weekly provider scheduling slots (0=Sunday .. 6=Saturday) and date overrides. |
| **Booking** | `bookings` | `_id`, `bookingReference` (unique), `customer`, `provider`, `service` | `customer`, `provider`, `status`, `scheduledDate`, `address.location` (`2dsphere`) | Service request and order lifecycle (`pending`, `accepted`, `in_progress`, `completed`, `cancelled`, `rejected`). |
| **Review** | `reviews` | `_id`, `booking` (ref: `Booking`, unique), `customer`, `provider`, `service` | `booking` (unique), `provider`, `rating`, `customer`, `service` | Ratings (1-5) and customer feedback with provider reply support. |
| **Notification** | `notifications`| `_id`, `recipient` (ref: `User`) | Compound: `{ recipient: 1, isRead: 1, createdAt: -1 }` | In-app alerts for bookings, payments, and system updates. |
| **Admin** | `admins` | `_id`, `user` (ref: `User`, unique) | `user`, `permissions` | Administrative staff profiles with granular RBAC permission scopes. |

---

## Running Verification Tests

From `backend` directory:
```bash
npm run test:models   # Validates all 11 Mongoose schemas and relationships
npm run test:health   # Runs health check and 404 middleware against an active Express instance
npm test              # Runs both test suites
```
