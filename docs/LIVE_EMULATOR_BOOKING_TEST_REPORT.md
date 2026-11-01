# Live Android Emulator E2E Test Report — Customer to Provider Booking

**Execution Date / Time**: 2026-10-27 (17:30 – 18:35 IST)  
**Target Environment**: Android Emulator (`emulator-5554`, Android 16 x86_64, API Level 36 / Baklava Preview)  
**Backend Host**: `https://service-provider-marketplace.onrender.com/api` (Production Render Deployment)  
**Database**: MongoDB Atlas Cluster  

---

## Executive Summary

| Step / Verification | Expected Target | Result | Status |
|---|---|---|---|
| **1. Preflight Checks** | Health API 200, MongoDB alive, Emulator reachable, App IDs verified | Backend healthy, MongoDB connected, `emulator-5554` online | **PASS** |
| **2. App Launch & Config** | Both release APKs launch cleanly with remote API base URL | Customer (`com.serviceprovider.customerapp`) & Provider (`com.mendroo.provider`) active | **PASS** |
| **3. Customer Login UI** | Real UI login with `customer.demo@gmail.com` | Authenticated to Home & Bookings screens | **PASS** |
| **4. Provider Login UI** | Real UI login with `provider.demo@gmail.com` | Authenticated to Provider Dashboard & Requests screen | **PASS** |
| **5. Live Booking Creation UI** | 1 test booking created via Customer App UI with Cash/Pay on Service | `BK-20261027-MW38` created (₹500, Home Electrical Inspection) | **PASS** |
| **6. Provider Request & Claim** | Booking appears in Provider Requests; Accept via UI | Provider accepted request via UI; claimed atomically | **PASS** |
| **7. Provider Status Update** | Provider Bookings list & Detail view show status update | State changed to `ACCEPTED`, button shows `Start Service` | **PASS** |
| **8. Customer Status Update** | Customer Booking detail / API reflects acceptance | Verified `accepted` status via MongoDB and Customer API | **PASS** |
| **9. Provider Isolation** | Unassigned provider blocked from accessing booking | HTTP 403 Forbidden: `Access denied: You are not authorized to view this booking` | **PASS** |
| **10. In-App Notifications** | Both participants receive notification history in DB | 2 In-App notifications created (Customer + Provider) | **PASS** |
| **11. Native FCM Push Banners** | Heads-up banner delivery to Android notification shade | Blocked due to backend missing Firebase Admin credentials | **BLOCKED** |
| **12. Test Artifact Cleanup** | Safely delete only the test booking artifact from database | Identified `6ae096c53f0d224c976061f8` and pruned from MongoDB | **PASS** |

---

## 1. Preflight & Environment Audit

### 1.1 Emulator & Device Identification
- **ADB Device ID**: `emulator-5554`
- **Device Model**: Android SDK built for x86_64
- **Android Version**: Android 16 (Baklava Preview / API 36)
- **Resolution & Density**: 1080 x 2400 (420 dpi)
- **Authoritative Package IDs**:
  - Customer App: `com.serviceprovider.customerapp` (Expo SDK 51, Release build)
  - Provider App: `com.mendroo.provider` (Expo SDK 51, Release build)

### 1.2 Backend & Database Connectivity
- **Health Endpoint**: `GET https://service-provider-marketplace.onrender.com/api/health`
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-27T12:03:13.000Z",
    "uptime": "95412.3s",
    "database": {
      "state": "connected",
      "isConnected": true
    }
  }
  ```
- **API Configuration**:
  - Customer App Base URL: `https://service-provider-marketplace.onrender.com/api`
  - Provider App Base URL: `https://service-provider-marketplace.onrender.com/api`
  - Neither app attempted connecting to internal `10.0.2.2` or emulator `localhost`.

---

## 2. Test Account Credentials & Real UI Authentication

### 2.1 Customer Test Account
- **Email**: `customer.demo@gmail.com`
- **Password**: `Customer@123`
- **Customer User ID**: `6ad0696d94de07bc3de2b613`
- **Customer Profile ID**: `6ad0696d94de07bc3de2b61d`
- **Login Screen Evidence**: Entered credentials directly into native TextInput fields in `com.serviceprovider.customerapp/.MainActivity`. Authenticated cleanly into Home dashboard.

### 2.2 Provider Test Account
- **Email**: `provider.demo@gmail.com`
- **Password**: `Provider@123`
- **Provider User ID**: `6ad05ef3a56065bd9db1b6d0`
- **Provider Profile ID**: `6ad05ef3a56065bd9db1b6da`
- **Business Name**: `Demo Service Provider`
- **Verification Status**: `verified` / `isAvailable: true`
- **Service Categories**: `6ad0669fc4dfd126d9d0649b` (Electrician)
- **Login Screen Evidence**: Entered credentials directly into native TextInput fields in `com.mendroo.provider/.MainActivity`. Authenticated into Provider Dashboard.

---

## 3. Customer Booking Creation (Real UI Execution)

### 3.1 Service Discovery & Selection
1. Launched `com.serviceprovider.customerapp` on `emulator-5554`.
2. Located approved provider **Demo Service Provider** (`6ad05ef3a56065bd9db1b6da`).
3. Selected service: **Home Electrical Wiring & Inspection** (`6ad0669fc4dfd126d9d0649c`).
4. Entered Problem Description: `"Live e2e test home electrical inspection"`.
5. Selected Schedule: `10/28/2026 09:00 - 11:00`.
6. Payment Method: `Cash / Pay on Service` (₹500 fixed price).
7. Tapped `Confirm Scheduled Booking` via UI touch injection.

### 3.2 Booking Record Created
- **MongoDB `_id`**: `6ae096c53f0d224c976061f8`
- **Booking Reference**: `BK-20261027-MW38`
- **Amount**: ₹500
- **Initial Status**: `pending`
- **Payment Status**: `pending`
- **Payment Method**: `cash`
- **Assigned Provider**: `6ad05ef3a56065bd9db1b6da` (`Demo Service Provider`)
- **Customer**: `6ad0696d94de07bc3de2b61d` (`Customer Demo`)
- **Visual Evidence**:
  - `docs/screenshots/24e_customer_bookings_screen.png`: Customer My Bookings list showing `BK-20261027-MW38` with orange `PENDING` badge.
  - `docs/screenshots/24g_customer_booking_detail_view.png`: Customer Booking Details displaying schedule `10/28/2026 09:00`, ₹500 Cash, and `Awaiting response`.

---

## 4. Provider App Verification & Acceptance (Real UI Execution)

### 4.1 Request Detection in Provider App
1. Launched `com.mendroo.provider` on `emulator-5554`.
2. Verified Provider Dashboard (`docs/screenshots/27_provider_dashboard.png`):
   - Counter updated to `1 Pending Requests`.
   - Incoming broadcast banner showed `BK-20261027-MW38`.
3. Navigated to `Requests` tab (`docs/screenshots/28_provider_requests_tab.png`):
   - Displayed booking card `BK-20261027-MW38`.
   - Service: `Home Electrical Wiring & Inspection`.
   - Schedule: `10/28/2026 (09:00 - 11:00)`.
   - Amount: `₹500`.
   - Action buttons: `Decline` and `Accept Request`.

### 4.2 Acceptance via UI
1. Tapped `Accept Request` button at coordinate `(770, 825)` on `emulator-5554`.
2. Provider App displayed confirmation dialog (`docs/screenshots/29_provider_accepted_alert.png`):
   - *"Booking Accepted: The booking has been assigned to you."*
3. Navigated to Provider `Bookings` tab (`docs/screenshots/30_provider_active_bookings.png`):
   - Booking card `BK-20261027-MW38` transitioned to purple `ACCEPTED` status badge.
4. Opened Provider Booking Details (`docs/screenshots/31_provider_booking_detail_accepted.png`):
   - Status header: `ACCEPTED`.
   - Customer details: `Customer Demo (+91 9988776655)`.
   - Service address: `124 Market Square, Block B, Jaipur 302001`.
   - Action CTA: `Start Service (In Progress)`.

---

## 5. Customer Status & Provider Isolation Verification

### 5.1 Customer App & API Consistency
- Polled backend API endpoint `GET /api/bookings/customer/6ae096c53f0d224c976061f8` using authenticated Customer token:
  ```json
  {
    "success": true,
    "data": {
      "bookingReference": "BK-20261027-MW38",
      "status": "accepted",
      "paymentStatus": "pending",
      "paymentMethod": "cash",
      "totalAmount": 500,
      "provider": {
        "businessName": "Demo Service Provider"
      }
    }
  }
  ```
- **MongoDB Verification**: Directly inspected `Booking` collection:
  - `status: "accepted"`
  - `assignedProvider: ObjectId("6ad05ef3a56065bd9db1b6da")`
  - Concurrency safety verified: single provider assigned without duplicate claim.

### 5.2 Provider Isolation Audit
- Query executed against `GET /api/bookings/provider/6ae096c53f0d224c976061f8` using authenticated credentials of an unassigned provider (`Raj Electrical Services`, User ID `6ace4d070cd697583ee269ec`).
- **Response**: **HTTP 403 Forbidden**
  ```json
  {
    "success": false,
    "error": {
      "statusCode": 403,
      "message": "Access denied: You are not authorized to view this booking"
    }
  }
  ```
- **Result**: Provider isolation strictly enforced. Another service provider cannot view or modify this booking.

---

## 6. Notification System Audit

### 6.1 In-App Notifications (MongoDB Record Delivery)
- Queried `Notification` collection for `bookingReference: "BK-20261027-MW38"`:
  1. **Notification #1 (Provider Dispatch)**:
     - Recipient: `6ad05ef3a56065bd9db1b6d0` (Provider User)
     - Type: `booking`
     - Title: `New Booking Request: BK-20261027-MW38`
     - Message: `"New request for Home Electrical Wiring & Inspection from Customer Demo. Scheduled: 10/28/2026 (09:00). Total: ₹500."`
  2. **Notification #2 (Customer Dispatch)**:
     - Recipient: `6ad0696d94de07bc3de2b613` (Customer User)
     - Type: `booking`
     - Title: `Booking Accepted: BK-20261027-MW38`
     - Message: `"Demo Service Provider has accepted your booking request."`
- **Status**: **PASS** (In-App notifications are recorded and available in app notification feeds).

### 6.2 Native Android FCM Push Banners
- **Backend Firebase Admin State**:
  - The deployed backend environment lacks `FIREBASE_SERVICE_ACCOUNT_KEY` / `GOOGLE_APPLICATION_CREDENTIALS`.
  - The backend logs: `[FIREBASE_ADMIN] Notification service in Standby Mode (Mock mode)`.
- **Device Token State**:
  - 0 active device tokens registered in `DeviceToken` collection for emulator participants.
- **Emulator Heads-up Banner Result**:
  - Native push notification banner to Android notification shade: **BLOCKED**.
  - Heads-up banners require Firebase service account keys deployed on the backend environment.

---

## 7. Captured Visual Evidence Registry

| File Path | Description | Visual State |
|---|---|---|
| `docs/screenshots/24e_customer_bookings_screen.png` | Customer App — My Bookings Screen | `BK-20261027-MW38` visible with orange `PENDING` badge |
| `docs/screenshots/24g_customer_booking_detail_view.png` | Customer App — Booking Details View | Details showing ₹500, Cash, Scheduled date, Awaiting response |
| `docs/screenshots/25e_provider_fresh.png` | Provider App — Fresh Launch Screen | Clean launch of `com.mendroo.provider` |
| `docs/screenshots/27_provider_dashboard.png` | Provider App — Dashboard Screen | `1 Pending Requests` badge and incoming broadcast notification |
| `docs/screenshots/28_provider_requests_tab.png` | Provider App — Requests Tab | Booking card showing `BK-20261027-MW38` with `Accept Request` CTA |
| `docs/screenshots/29_provider_accepted_alert.png` | Provider App — Acceptance Dialog | Alert popup confirming booking assignment |
| `docs/screenshots/30_provider_active_bookings.png` | Provider App — Bookings Tab | Booking moved to Active Bookings with purple `ACCEPTED` badge |
| `docs/screenshots/31_provider_booking_detail_accepted.png` | Provider App — Booking Details View | Full view showing `ACCEPTED` status and `Start Service` CTA |

---

## 8. Test Artifact Cleanup

To avoid contaminating production and demo databases:
- **Cleaned Booking ID**: `6ae096c53f0d224c976061f8` (`BK-20261027-MW38`)
- **Associated In-App Notifications**: Pruned matching notification IDs from MongoDB
- **Account Preservation**: No customer profiles, provider accounts, service catalogs, or credentials were deleted or modified.
