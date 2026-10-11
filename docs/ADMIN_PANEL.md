# Admin Panel Documentation (Phase 4)

## Overview
The Admin Panel is a single-page management dashboard built with React, Vite, React Router, Tailwind CSS, and Lucide React. It communicates with the Express backend using a centralized Axios client and enforces JWT authentication with administrative role checks.

---

## 1. Environment Configuration

The Admin Panel requires an environment file `admin-panel/.env` (modeled after `admin-panel/.env.example`):

```env
# Base URL for the Express backend REST API
VITE_API_URL=http://localhost:5000/api
```

- **Configuring the Backend API URL**: Set `VITE_API_URL` to point to the active backend instance (e.g. `http://localhost:5000/api` for local development, or your production URL).
- If omitted, the Axios client automatically falls back to `http://localhost:5000/api`.

---

## 2. Running the Admin Panel

From `E:\SERVICE-PROVIDER-MARKETPLACE\admin-panel`:

### Development Mode
```bash
npm run dev
```
Starts the Vite local development server (typically running on `http://localhost:5173`).

### Production Build
```bash
npm run build
```
Generates optimized static assets in `admin-panel/dist`.

### Production Preview
```bash
npm run preview
```
Previews the production build locally.

---

## 3. Authentication & Session Architecture

### Endpoints Integrated
- **Admin Login**: `POST /api/auth/login/admin`
  - Body: `{ email: "admin@example.com", password: "your_password" }`
  - Validates role `admin` and account status `isActive: true`.
  - Returns JWT bearer token along with sanitized user and admin profile objects (`permissions`, `department`).
- **Session Restoration / Me**: `GET /api/auth/me`
  - Header: `Authorization: Bearer <token>`
  - Restores authenticated administrator session on page refresh or browser restart.

### Route Protection & Security
- `ProtectedRoute`: Verifies authentication and ensures `user.role === 'admin'`. Non-authenticated requests are redirected to `/login` preserving the target path. Displays a full-screen loading state during credential verification to prevent protected content flashing.
- `PublicRoute`: Redirects authenticated administrators directly to `/` (Dashboard).
- `API Interceptors`: Automatically injects `Authorization: Bearer <token>`. Intercepts HTTP 401 responses to clear invalid/expired tokens and notify `AuthContext` without crashing.

---

## 4. Navigation & Page Structure

All 11 primary administrative pages have been structured with a professional dark navy/neutral sidebar, responsive mobile menu drawer, and account menu:

1. **Dashboard** (`/`): Welcome banner with administrator details, honest metric placeholders, quick action navigation links, and system activity empty state.
2. **Customers** (`/customers`): Registered consumer account directory, search and status filter shell, pending API integration indicator.
3. **Providers** (`/providers`): Service provider directory, business information filters, pending API indicator.
4. **Provider Verification** (`/provider-verification`): Review queue for contractor credential validation, onboarding review indicators.
5. **Categories** (`/categories`): Service category taxonomy, modal shell for new category creation, pending API indicator.
6. **Services** (`/services`): Standardized service catalog, pricing configurations, and duration filters.
7. **Service Requests / Bookings** (`/requests`): Customer booking dispatch, lifecycle monitoring, dispute oversight.
8. **Reviews** (`/reviews`): Consumer feedback and contractor ratings moderation shell.
9. **Service Areas** (`/locations`): Geofence zones, coverage postal codes, and city boundaries.
10. **Reports** (`/reports`): Financial gross volume, provider disbursements, booking performance metrics.
11. **Settings** (`/settings`): Authenticated administrator profile, assigned permissions, department, and runtime connectivity configuration.

---

## 5. Authentication Limitations & MongoDB Status

- **Database Connection**: In the default development environment, MongoDB is not connected (`MONGODB_URI` unconfigured).
- **Persistent Account Login**: Real administrative login requires a running MongoDB database with a seeded administrator document (User record with `role: "admin"` and linked Admin profile record).
- **Insecure Accounts**: No insecure default credentials have been hardcoded or injected into the codebase.
- **Pending Modules**: CRUD operations for subsequent phases (such as Categories, Services, and Bookings) display honest empty states clearly indicating that backend API integration is pending.

---

## 6. Verification Results

- **Build Test**: `npm run build` executed cleanly with 0 errors (1,575 modules transformed, production bundle built in ~5.75s).
- **Backend API Tests**:
  - `node test_health.js` -> 200 OK (System operational, reporting DB status).
  - `node test_auth_http.js` -> All HTTP validation tests passed (401 on missing token, 400 on invalid input).
  - `node test_auth_unit.js` -> All Phase 3 unit tests passed (JWT generation, role checks, password hashing).
