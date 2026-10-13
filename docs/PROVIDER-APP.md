# Provider Mobile App Documentation

## 1. Overview

The Service Provider mobile app is an Expo React Native application tailored for verified marketplace professionals to manage their working availability, operations territories, offered services catalog, job requests, and service lifecycle execution.

## 2. Navigation Architecture

- **Auth Navigator**:
  - `LoginScreen.js` — Provider login with JWT issuance.
  - `RegisterScreen.js` — Provider onboarding registration.
- **Tab Navigator**:
  - `RequestsTab` (`RequestsScreen.js`) — Real-time pending booking requests queue.
  - `HistoryTab` (`HistoryScreen.js`) — Past and assigned jobs history.
  - `ProfileTab` (`ProfileScreen.js`) — Provider business dossier and account hub.
- **Root Stack Navigations**:
  - `BookingDetail` (`BookingDetailScreen.js`) — Complete booking lifecycle transitions (`accept`, `start`, `complete`, `reject`).
  - `Availability` (`AvailabilityScreen.js`) — Monday–Sunday weekly schedule manager.
  - `ServiceAreas` (`ServiceAreasScreen.js`) — Operational territory and zip codes manager.
  - `OfferedServices` (`ProviderServicesScreen.js`) — Custom service pricing and catalog offerings manager.

## 3. Weekly Availability Management (`AvailabilityScreen.js`)

- Configures working days Monday through Sunday.
- Individual daily toggles (`Enabled` vs `Off`).
- Time slot editor validating `HH:mm` format with strict start-before-end verification (`startTime < endTime`).
- Syncs directly with `GET /api/providers/me/availability` and `PUT /api/providers/me/availability`.
- Scheduled customer bookings strictly re-validate that the target provider is enabled and working on the scheduled appointment day and time slot.

## 4. Service Area Management (`ServiceAreasScreen.js`)

- Providers define coverage zones specifying Area Name, City, State, and covered Zip Codes.
- Supports GeoJSON coordinates when supplied.
- Syncs with `GET /api/providers/me/service-areas`, `POST /api/providers/me/service-areas`, `PUT /api/providers/me/service-areas/:id`, and `DELETE /api/providers/me/service-areas/:id`.
- Scheduled bookings verify that the customer's service address falls within the provider's active coverage zones.

## 5. Service Offerings Catalog (`ProviderServicesScreen.js`)

- Allows providers to define custom service pricing and descriptions under approved administrative categories.
- Providers can toggle their offerings (`Active` / `Inactive`).
- Syncs with `/api/providers/me/services`.

## 6. Running the Provider App

```bash
cd provider-app
npm run start
# For Android:
npm run android
# For Web:
npm run web
```
