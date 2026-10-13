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

---

## Data Integrity & Referential Rules

1. **Category Deletion**:
   - Protected against deletion if referenced by any `Service` records (`servicesCount > 0`).
   - Returns HTTP 409 Conflict with guidance to deactivate the category instead.
2. **Service Deletion**:
   - Protected against deletion if referenced by any `Booking` records (`bookingsCount > 0`).
   - Returns HTTP 409 Conflict with guidance to deactivate the service instead, preserving historical booking and audit records.
3. **Service Active State**:
   - An active service (`isActive: true`) cannot be created under or moved to an inactive category.
4. **Duplicate Service Prevention**:
   - Services must have unique names within the same category (case-insensitive).
5. **Pricing Constraints**:
   - Fixed and hourly services require positive prices (`price > 0`).
6. **Provider Verification Lifecycle**:
   - Provider starts in `pending` verification status with unverified user account.
   - Documents are tracked via `documents` array (`type`, `documentUrl`, `verificationStatus`: `pending` | `approved` | `rejected`, `reviewNote`, `reviewedAt`).
   - Resubmitting a rejected document automatically resets document status to `pending`, and resets provider status to `pending` if previously rejected.
   - Provider only becomes discoverable on public endpoints when `verificationStatus === 'verified'` AND user `isActive === true`.
   - Providers may only associate active categories.
   - Suspended or rejected providers are excluded from public search and cannot receive bookings.

8. **Booking Lifecycle & Scheduling Rules**:
   - Two booking modes: `instant` (immediate request with ASAP time slot broadcast to eligible candidate providers) and `scheduled` (future date validation and time slot).
   - Validated State Machine: `pending -> accepted -> in_progress -> completed`.
   - Concurrency Safety: Atomic conditional update (`findOneAndUpdate({ status: 'pending', ... })`) ensures that only one provider can accept an open instant booking request; competing candidates receive a 409 Conflict.
   - Cancellation Policy: Customers can only cancel `pending` or `accepted` bookings. Services `in_progress` or `completed` cannot be cancelled.
   - Pricing Immutability: Total amounts are derived exclusively from database service prices and trusted server-side rules.
   - Status Timestamps: `statusTimestamps` tracks `acceptedAt`, `inProgressAt`, `completedAt`, `cancelledAt`, and `rejectedAt`.

9. **Customer Saved Addresses & Profile Rules (Phase 11)**:
   - Customers store multiple addresses in `Customer.addresses` subdocuments.
   - Default Address Exclusivity: Exactly one address can be `isDefault: true`. Marking any address as default automatically demotes previous defaults.
   - Deletion Resilience: Deleting a default address promotes the first remaining saved address as default. Historical booking records retain address snapshots and are unaffected.

10. **Provider Availability & Service Areas (Phase 11)**:
   - Weekly schedules stored in `Availability` model with unique index on `{ provider: 1, dayOfWeek: 1 }`.
   - Time slots validate `HH:mm` format and `startTime < endTime`.
   - Service areas store city and zip codes. Scheduled bookings revalidate provider availability for `scheduledDate.getDay()` and confirm service area match.

---

## Running Verification Tests

From `backend` directory:
```bash
npm run test:models       # Validates all 11 Mongoose schemas and relationships
npm run test:health       # Runs health check and 404 middleware against an active Express instance
npm run test:auth         # Runs auth unit and HTTP validation tests
npm run test:categories   # Runs category live integration tests (against MongoDB Atlas)
npm run test:services     # Runs service unit validation & Atlas integration tests
npm run test:providers    # Runs provider unit validation & Atlas integration tests
npm run test:bookings     # Runs booking unit validation & Atlas integration tests
node test_phase11_unit.js # Runs Phase 11 customer profile & provider availability unit suite
npm test                  # Runs core backend test suites
```


