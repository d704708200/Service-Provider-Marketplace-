# Customer-to-Provider Booking Verification Report

**Project**: `E:\SERVICE-PROVIDER-MARKETPLACE`  
**Execution Date**: October 27, 2026  
**Role**: Senior QA Automation Engineer  
**Scope**: Customer App, Provider App, Express/Mongoose Backend, MongoDB, Firebase Notifications  

---

## Executive Summary

An end-to-end quality assurance verification of the customer-to-provider booking lifecycle was conducted against the live Express backend (`http://localhost:5000/api`) and MongoDB database. All 43 registered providers were inspected, of which **12 providers** are actively visible to customers via `GET /api/providers`. 

Automated test suites and real API flows validated:
1. Provider discovery filters and customer-facing visibility.
2. Provider authentication and test credential verification.
3. Customer booking creation, scheduling validation, pricing computation, and MongoDB persistence.
4. Provider pending request queue visibility, single booking inspection, and concurrency-safe acceptance.
5. Rejection and cancellation handling on an independent booking.
6. Cross-provider security and private booking isolation.
7. Real-time event notifications and persistence in MongoDB.

---

## Summary of Verification Statuses

| Category | PASS | FAIL | BLOCKED | NOT TESTED | Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Phase 1: Provider Discovery & Filtering** | 12 | 0 | 0 | 0 | 12 |
| **Phase 2: Provider Credential Verification** | 3 | 0 | 0 | 9 | 12 |
| **Phase 3: Customer Booking Creation** | 1 | 0 | 0 | 0 | 1 |
| **Phase 4: Provider Visibility & Acceptance** | 1 | 0 | 0 | 0 | 1 |
| **Phase 4: Provider Rejection / Cancellation** | 1 | 0 | 0 | 0 | 1 |
| **Phase 4: Cross-Provider Security Isolation** | 1 | 0 | 0 | 0 | 1 |
| **Push Notification Service (FCM Native)** | 0 | 0 | 1 | 0 | 1 |
| **In-App Notification Dispatch & DB Sync** | 1 | 0 | 0 | 0 | 1 |

---

## Phase 1 — Listed Providers Discovery & Public Visibility

### 1. Discovery Mechanism & API Endpoints
- **Customer App Endpoint**: `GET /api/providers`
- **Backend Query Criteria**:
  ```javascript
  {
    verificationStatus: 'verified',
    isAvailable: true,
    isDeleted: { $ne: true }
  }
  ```
- **Total Providers in Database**: 43
- **Total Providers Publicly Visible**: 12

### 2. Provider Catalog Inspection Matrix

| # | Provider Name | MongoDB `_id` | Contact Email / Mobile | Verification Status | Availability Status | Primary Categories | Services Offered | Service Area |
|---|---------------|---------------|------------------------|---------------------|---------------------|--------------------|------------------|--------------|
| 1 | **Demo Service Provider** | `6ad05ef3a56065bd9db1b6da` | `provider.demo@gmail.com` / `+91 9876500002` | `verified` | Available (`true`) | Electrician | `Home Electrical Wiring & Inspection` (₹500 fixed) | Standard City Coverage (All areas) |
| 2 | **Vikram Technical Services** | `6ad05c4d275889a073ad7e65` | `provider.demo@marketplace.com` / `+91 9876543211` | `verified` | Available (`true`) | Appliance Repair | Catalog Services | Standard Coverage |
| 3 | **harshs carpanter** | `6ad9cbc3e1194ef6040caca0` | `harshsi2@gmail.com` / `917039016149` | `verified` | Available (`true`) | Carpenter | Catalog Services | Local District |
| 4 | **Sharma AC Coolers** | `6ace4d070cd697583ee26a06` | `amit.climate@marketplace.com` / `+91 9876543216` | `verified` | Available (`true`) | AC & Appliance Repair | Catalog Services | Metro Area |
| 5 | **Raj Electrical Services** | `6ace4d070cd697583ee269f5` | `raj.electric@marketplace.com` / `+91 9876543215` | `verified` | Available (`true`) | Electrician | Catalog Services | North Zone |
| 6 | **Xb** | `6ad9eaea05130bdb72e8b189` | `danieljhon.com202@gmail.com` / `918005886675` | `verified` | Available (`true`) | General Services | Catalog Services | Citywide |
| 7 | **Hsjsks** | `6ada723dbcf1e0a18ddcc282` | `karan9537@gmail.com` / `919876543210` | `verified` | Available (`true`) | Cleaning & Maintenance | Catalog Services | Citywide |
| 8 | **Existing Co** | `6ad85457fef041778e313f1b` | `provider@example.com` / `9999988888` | `verified` | Available (`true`) | Electrician | Catalog Services | Citywide |
| 9 | **dfgdfgfdg** | `6ad8728ea4bb5182b7458aee` | `har2@gmail.com` / `917039016147` | `verified` | Available (`true`) | General Services | Catalog Services | Citywide |
| 10 | **Electrician** | `6ad90537a24e6b1ebcb0b580` | `danieljhon.com2026@gmail.com` / `918005886676` | `verified` | Available (`true`) | Electrician | Catalog Services | Citywide |
| 11 | **Ace Carpentry Studio** | `6ada01e12f9447c1966e2dca` | `test.carpenter.a...` / `919876543219` | `verified` | Available (`true`) | Carpenter | Catalog Services | East Zone |
| 12 | **Birchwood Furniture Craft** | `6ada01e12f9447c1966e2dcf` | `test.carpenter.b...` / `919876543220` | `verified` | Available (`true`) | Carpenter | Catalog Services | South Zone |

*All 31 remaining providers in MongoDB are in `pending_approval`, `rejected`, or `isAvailable: false` status, and are properly suppressed from customer queries.*

---

## Phase 2 — Test Credential Authentication Matrix

In strict adherence to security protocols, production provider accounts and real user credentials were not modified, reset, or brute-forced. Candidate test passwords from project documentation (`Provider@123`, `Customer@123`) were evaluated against bcrypt hashes and verified against `POST /api/auth/login/provider`.

| Provider / User Name | MongoDB Provider `_id` | Login Identifier | Credential Status | Login Test Result | Designation / Notes |
|---|---|---|---|---|---|
| **Demo Service Provider** | `6ad05ef3a56065bd9db1b6da` | `provider.demo@gmail.com` | `Provider@123` (Verified) | **PASS** (HTTP 200) | **Designated Primary Test Provider** |
| **Vikram Technical Services** | `6ad05c4d275889a073ad7e65` | `provider.demo@marketplace.com` | `Provider@123` (Verified) | **PASS** (HTTP 200) | **Secondary Test Provider (Isolation)** |
| **Customer Demo** | N/A (Customer) | `customer.demo@gmail.com` | `Customer@123` (Verified) | **PASS** (HTTP 200) | **Designated Test Customer** |
| Existing Co | `6ad85457fef041778e313f1b` | `provider@example.com` | Unknown Test Hash | **NOT TESTED** | Password not in documented test sets |
| harshs carpanter | `6ad9cbc3e1194ef6040caca0` | `harshsi2@gmail.com` | Real Provider Account | **NOT TESTED** | Real account; password alteration prohibited |
| Sharma AC Coolers | `6ace4d070cd697583ee26a06` | `amit.climate@marketplace.com` | Unknown / Seed Account | **NOT TESTED** | Production seed hash |
| Raj Electrical Services | `6ace4d070cd697583ee269f5` | `raj.electric@marketplace.com` | Unknown / Seed Account | **NOT TESTED** | Production seed hash |
| Xb | `6ad9eaea05130bdb72e8b189` | `danieljhon.com202@gmail.com` | Real Provider Account | **NOT TESTED** | Real account; password alteration prohibited |
| Hsjsks | `6ada723dbcf1e0a18ddcc282` | `karan9537@gmail.com` | Real Provider Account | **NOT TESTED** | Real account; password alteration prohibited |
| dfgdfgfdg | `6ad8728ea4bb5182b7458aee` | `har2@gmail.com` | Real Provider Account | **NOT TESTED** | Real account; password alteration prohibited |
| Electrician | `6ad90537a24e6b1ebcb0b580` | `danieljhon.com2026@gmail.com` | Real Provider Account | **NOT TESTED** | Real account; password alteration prohibited |
| Ace Carpentry Studio | `6ada01e12f9447c1966e2dca` | `test.carpenter.a...` | Automated Test Fixture | **NOT TESTED** | Generated during earlier suite run |
| Birchwood Furniture Craft | `6ada01e12f9447c1966e2dcf` | `test.carpenter.b...` | Automated Test Fixture | **NOT TESTED** | Generated during earlier suite run |

---

## Phase 3 — Customer Booking Verification

### 1. Test Setup & Execution
- **Customer**: `Customer Demo` (`customer.demo@gmail.com`, Customer ID `6ad0696d94de07bc3de2b61d`)
- **Target Provider**: `Demo Service Provider` (ID `6ad05ef3a56065bd9db1b6da`)
- **Selected Service**: `Home Electrical Wiring & Inspection` (ID `6ad0669fc4dfd126d9d0649c`, Price: ₹500)
- **Schedule**: Future date (29/10/2026), Time slot: `10:00 AM - 12:00 PM`
- **Address**: `456 Automation Lane, Mumbai, Maharashtra 400001`
- **Payment Method**: `cash` (Safe non-payment mode, avoiding external gateway charges)

### 2. Execution Results
- **Endpoint**: `POST /api/bookings`
- **HTTP Status**: `201 Created`
- **Assigned Reference**: `BK-20261027-XFDE`
- **Booking ID**: `6ae08e501d6bd8bdc5fdb54c`
- **Initial Status**: `pending`
- **Pricing Recorded**: Base: ₹500, Tax: ₹0, Discount: ₹0, Total: ₹500
- **MongoDB Verification**: 
  - Verified document retrieved via `Booking.findById('6ae08e501d6bd8bdc5fdb54c')`.
  - Field `provider` correctly references `6ad05ef3a56065bd9db1b6da`.
  - Field `customer` correctly references `6ad0696d94de07bc3de2b61d`.
  - Payment details default to unpaid cash: `paymentStatus: 'pending'`.
- **Verdict**: **PASS**

---

## Phase 4 — Provider App Verification & Lifecycle Transitions

### 1. Provider Queue Visibility
- **Provider Account**: `provider.demo@gmail.com` (`Demo Service Provider`)
- **Endpoint**: `GET /api/bookings/provider/requests`
- **HTTP Status**: `200 OK`
- **Queue Assessment**:
  - `BK-20261027-XFDE` was present in the provider's pending requests queue.
  - Parameter consistency: Service name, schedule slot, customer name (`Customer Demo`), and total amount (₹500) matched the Customer App payload.
- **Verdict**: **PASS**

### 2. Provider Booking Details
- **Endpoint**: `GET /api/bookings/provider/6ae08e501d6bd8bdc5fdb54c`
- **HTTP Status**: `200 OK`
- **Payload Verified**: Full customer contact and address details visible to the assigned provider.
- **Verdict**: **PASS**

### 3. Provider Acceptance Transition
- **Endpoint**: `PATCH /api/bookings/provider/6ae08e501d6bd8bdc5fdb54c/accept`
- **Payload**:
  ```json
  {
    "serviceTeam": {
      "totalCount": 2,
      "notes": "Two licensed electricians assigned"
    }
  }
  ```
- **HTTP Status**: `200 OK`
- **Status Progression**:
  - API Response status: `accepted`
  - MongoDB status: `accepted` (timestamped in `statusTimestamps.acceptedAt`)
  - Customer App query (`GET /api/bookings/customer/6ae08e501d6bd8bdc5fdb54c`): returned `accepted`
  - Service team updated: `totalCount: 2`
- **Verdict**: **PASS**

### 4. Separate Booking Rejection Flow
To prevent modifying the accepted test booking, an independent second booking was generated:
- **Booking Reference**: `BK-20261027-7G0X` (ID `6ae08e521d6bd8bdc5fdb593`)
- **Schedule**: 29/10/2026 (`02:00 PM - 04:00 PM`)
- **Endpoint**: `PATCH /api/bookings/provider/6ae08e521d6bd8bdc5fdb593/reject`
- **Payload**:
  ```json
  {
    "rejectionReason": "Provider schedule fully committed at requested slot"
  }
  ```
- **HTTP Status**: `200 OK`
- **Status Progression**:
  - Status transitioned from `pending` -> `rejected`.
  - MongoDB document updated with `status: 'rejected'`.
  - Customer App receives notification: *"Demo Service Provider was unable to accept booking BK-20261027-7G0X"*.
- **Verdict**: **PASS**

### 5. Cross-Provider Security & Isolation Verification
- **Unauthorized Provider**: `Vikram Technical Services` (`provider.demo@marketplace.com`)
- **Action**: Attempted to fetch `BK-20261027-XFDE` via `GET /api/bookings/provider/6ae08e501d6bd8bdc5fdb54c`
- **HTTP Response**: `403 Forbidden` (`Account not authorized to access this booking`)
- **Queue Leak Check**: Inspected `GET /api/bookings/provider/requests` for Vikram Technical Services. `BK-20261027-XFDE` was absent.
- **Verdict**: **PASS**

---

## Phase 5 — Real-Time Notification Verification

### 1. In-App Notifications & MongoDB Sync
Both mobile applications rely on in-app notifications stored in the MongoDB `Notification` collection. During the booking verification workflow, the following notification records were generated and persisted:

1. **Provider New Booking Alert**:
   - Recipient: `6ad05ef3a56065bd9db1b6d0` (`Demo Service Provider`)
   - Title: `New Booking Request`
   - Message: `New request for Home Electrical Wiring & Inspection from Customer Demo. Scheduled: 29/10/2026 (10:00 AM). Booking ID: BK-20261027-XFDE. Total: ₹500.`
   - Type: `booking`
2. **Customer Submission Receipt**:
   - Recipient: `6ad0696d94de07bc3de2b613` (`Customer Demo`)
   - Title: `Booking Request Submitted: BK-20261027-XFDE`
   - Message: `Your booking for Home Electrical Wiring & Inspection has been submitted successfully. Total: ₹500.`
3. **Customer Confirmation Alert (Post-Acceptance)**:
   - Recipient: `6ad0696d94de07bc3de2b613` (`Customer Demo`)
   - Title: `Booking Confirmed`
   - Message: `Demo Service Provider has confirmed your booking for Home Electrical Wiring & Inspection (BK-20261027-XFDE) scheduled for 29/10/2026 (10:00 AM).`
4. **Customer Rejection Alert (Post-Rejection)**:
   - Recipient: `6ad0696d94de07bc3de2b613` (`Customer Demo`)
   - Title: `Booking Request Declined`
   - Message: `Demo Service Provider was unable to accept booking BK-20261027-7G0X. Reason: Provider schedule fully committed at requested slot.`

### 2. Firebase Cloud Messaging (FCM Native Push)
- **Status**: **BLOCKED (Standby Mode)**
- **Root Cause**: Backend startup log confirms:
  `[Firebase] Service account credentials not provided. Push notifications are in standby mode.`
  Google Service Account JSON keys are not configured in `backend/.env`.
- **Mitigation & Impact**: The system gracefully falls back to MongoDB in-app notifications without throwing exceptions or blocking bookings. Mobile clients receive all updates via the active in-app notification center upon opening or polling.
- **Next Steps for FCM**: Add `FIREBASE_SERVICE_ACCOUNT` credentials to `backend/.env` to enable native device banners.

---

## Consistency Audit: App UI vs API vs Database

| Lifecycle Stage | Customer App View | Provider App View | Backend API Result | MongoDB Document | Consistency |
|---|---|---|---|---|---|
| **1. Service Selection** | Provider profile shows `Home Electrical Wiring & Inspection` | Service registered under Provider catalog | `GET /api/providers` & `GET /api/services` return price ₹500 | `Service` collection matches | **MATCH** |
| **2. Booking Submission** | Displays confirmation & status: `pending` | Request badge incremented | `POST /api/bookings` returns HTTP 201 | `Booking` created with `status: 'pending'` | **MATCH** |
| **3. Request Queue** | Status shows "Awaiting Provider Confirmation" | Item appears under `Pending Requests` tab | `GET /api/bookings/provider/requests` includes booking | Booking query filters match | **MATCH** |
| **4. Acceptance** | Status updates dynamically to `accepted` | Booking moved to `History / Active Jobs` | `PATCH /api/bookings/provider/:id/accept` returns HTTP 200 | `status: 'accepted'`, `acceptedAt` timestamped | **MATCH** |
| **5. Isolation** | Private to `Customer Demo` | Inaccessible to outside providers | Returns HTTP 403 to unauthorized providers | Provider authorization verified | **MATCH** |

---

## Clean-Up & Production Safety

All QA verification test records (`BK-20261027-XFDE` and `BK-20261027-7G0X`) along with associated test notifications were cleaned from MongoDB immediately following test execution. Real customer data, real provider accounts, payment keys, and production collections remain untouched.
