# Customer Mobile Application (Phase 9)

## 1. Architecture Overview

The Customer Mobile Application is built with React Native and Expo SDK 51, designed for Android and iOS mobile platforms as well as web preview.

- **Framework**: React Native `0.74.1` on Expo SDK `~51.0.8`
- **Language**: JavaScript (ES6+)
- **Navigation**: React Navigation (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`)
- **Networking**: Centralized Axios client with automatic Bearer token injection and response interceptors
- **Session & Storage**: `@react-native-async-storage/async-storage` for JWT persistence
- **Design System & Theme**: Curated Slate & Indigo color palette, typography scale, responsive spacing, card elevations, and `@expo/vector-icons` (Ionicons)

```
customer-app/
├── App.js                         # Root entry with SafeAreaProvider, AuthProvider, NavigationContainer
├── .env                           # Environment configuration (EXPO_PUBLIC_API_URL)
├── src/
│   ├── theme/                     # Design tokens (colors, typography, spacing, shadows, radius)
│   ├── constants/                 # Storage keys, pricing types, status tags
│   ├── storage/
│   │   └── authStorage.js         # AsyncStorage token & user persistence
│   ├── services/
│   │   └── api.js                 # Central Axios client and domain API modules
│   ├── context/
│   │   └── AuthContext.js         # Global authentication state, session check, login/register/logout
│   ├── components/
│   │   └── common/                # Reusable UI components (Button, Input, Header, Card, Badge, etc.)
│   ├── screens/
│   │   ├── auth/                  # LoginScreen, RegisterScreen
│   │   ├── home/                  # HomeScreen, CategoryServicesScreen
│   │   ├── services/              # ServicesScreen, ServiceDetailScreen
│   │   ├── providers/             # ProvidersScreen, ProviderDetailScreen
│   │   ├── booking/               # RequestServiceScreen (Staging preparation)
│   │   ├── history/               # BookingHistoryScreen (Phase 10 placeholder)
│   │   ├── notifications/         # NotificationsScreen (Phase 10 placeholder)
│   │   └── profile/               # ProfileScreen (Account details & logout)
│   └── navigation/
│       ├── AuthNavigator.js       # Stack for unauthenticated users (Login, Register)
│       ├── TabNavigator.js        # 5-Tab bottom navigation (Home, Services, Providers, Bookings, Profile)
│       └── RootNavigator.js       # Root conditional navigator based on authentication status
└── test_customer_flow.js          # Live integration test suite for customer endpoints
```

---

## 2. Authentication Flow & Role Enforcement

1. **Registration** (`POST /api/auth/register/customer`):
   - Form fields: `name`, `email`, `phone`, `password`.
   - Client-side validation: Full name >= 2 chars, valid email format, 10-digit mobile number, password >= 6 characters with letters and numbers.
   - Successful response stores JWT and user profile in AsyncStorage and sets context state.
2. **Login** (`POST /api/auth/login/customer`):
   - Validates email and password against backend contracts.
   - Rejects non-customer roles (`admin` or `provider`) with explicit role boundary errors.
   - Persists JWT and user profile to AsyncStorage.
3. **Session Restoration** (`GET /api/auth/me`):
   - Upon app launch, `checkAuthSession()` reads stored token and queries `/api/auth/me`.
   - If valid, restores user and customer profile.
   - If invalid (401), clears storage and redirects user to Login.
   - If network is unreachable, falls back gracefully to cached profile.
4. **Automatic 401 Logout**:
   - Axios response interceptor invokes `setOnUnauthorizedCallback()` upon receiving 401 Unauthorized, automatically triggering logout and navigation back to Auth stack.
5. **Logout**:
   - Clears AsyncStorage credentials and returns user to the login screen.

---

## 3. Real Backend API Endpoint Mapping

| Screen / Feature | Backend Endpoint | HTTP Method | Auth Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| Customer Register | `/api/auth/register/customer` | `POST` | No | Registers user with `role: 'customer'` and customer profile |
| Customer Login | `/api/auth/login/customer` | `POST` | No | Authenticates customer credentials and issues JWT |
| Session Validation | `/api/auth/me` | `GET` | Yes (Bearer) | Validates active session and retrieves customer profile |
| Category Discovery | `/api/categories` | `GET` | No | Fetches active categories for home grid and category screens |
| Services Catalog | `/api/services` | `GET` | No | Fetches public services with search, category, and pricing filters |
| Service Details | `/api/services/:id` | `GET` | No | Fetches full service details, pricing type, and inclusions |
| Provider Discovery | `/api/providers` | `GET` | No | Fetches verified and active providers for discovery cards |
| Provider Profile | `/api/providers/:id` | `GET` | No | Fetches public business bio, rating, and specialties |

---

## 4. Environment Configuration & Android Networking

The customer mobile application reads its API base URL from `customer-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

### Device-Specific Networking Guidance

| Environment | API Base URL | Notes |
| :--- | :--- | :--- |
| **Android Emulator** | `http://10.0.2.2:5000/api` | `10.0.2.2` aliases the development machine host loopback inside the Android emulator. |
| **Physical Android Device (LAN)** | `http://<YOUR_LOCAL_IP>:5000/api` | Replace `<YOUR_LOCAL_IP>` with your PC's Wi-Fi IPv4 address (e.g. `http://192.168.1.50:5000/api`). The phone and PC must be on the same local network. |
| **Web Browser Preview** | `http://localhost:5000/api` | Uses regular browser `localhost`. |

> **Important**: Never use `localhost` when debugging on physical Android devices, as `localhost` resolves to the phone itself rather than your development machine.

---

## 5. Commands to Run the Application

Navigate to the customer application directory:
```bash
cd customer-app
```

Start the Expo development server:
```bash
npm run start
```

Run on an attached Android device or running emulator:
```bash
npm run android
```

Run on Web:
```bash
npm run web
```

Run customer backend integration verification test suite:
```bash
node test_customer_flow.js
```

---

## 6. Booking Lifecycle Integration (Phase 10)

1. **Live Booking Creation (`POST /api/bookings`)**:
   - `RequestServiceScreen` connects to the live backend booking creation endpoint.
   - Supports both `Instant (ASAP)` and `Scheduled` booking modes.
   - Prevents duplicate submissions with pending states.
   - Shows real confirmation screen with the exact `bookingReference` (e.g. `BK-20261013-XXXX`) returned by the database.
2. **Booking History & Cancellations (`GET /api/bookings/customer`)**:
   - `BookingHistoryScreen` fetches customer's active and historical orders.
   - Supports filter tabs: `All`, `Pending`, `Accepted`, `In Progress`, `Completed`, `Cancelled`.
   - Customers can cancel `pending` or `accepted` bookings directly from the mobile app (`PATCH /api/bookings/customer/:id/cancel`).
3. **Deferred to Subsequent Phases**:
   - Payment gateway integration (cash on delivery / offline is currently used).
   - Real-time WebSockets / push notifications feed.
   - Customer profile address book manager.

