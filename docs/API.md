# Service Provider Marketplace API Documentation

## Base URL
- Local Development: `http://localhost:5000/api`
- Production: Configured via environment variables

---

## Authentication & Authorization Architecture
All protected routes require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```
Role-based access control enforces `admin`, `provider`, or `customer` roles.

---

## 1. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/customer` | Public | Register customer account and profile |
| `POST` | `/api/auth/login/customer` | Public | Customer authentication |
| `POST` | `/api/auth/register/provider` | Public | Register provider account (`pending` status) |
| `POST` | `/api/auth/login/provider` | Public | Provider authentication |
| `POST` | `/api/auth/login/admin` | Public | Administrator authentication |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |

---

## 2. Categories Endpoints (`/api/categories`)

### `GET /api/categories`
- **Access**: Public
- **Description**: Returns all active categories sorted by `displayOrder` ascending and name ascending for consumer and provider discovery.
- **Query Parameters**:
  - `search` (string, optional): Search keyword against name or description.
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Active categories retrieved successfully",
  "data": [
    {
      "_id": "67096e2a865f1a3089d7fa11",
      "name": "Plumbing Services",
      "slug": "plumbing-services",
      "description": "Licensed residential and commercial plumbing solutions",
      "icon": "Wrench",
      "image": null,
      "isActive": true,
      "displayOrder": 1,
      "createdAt": "2026-10-11T14:30:00.000Z",
      "updatedAt": "2026-10-11T14:30:00.000Z"
    }
  ]
}
```

---

### `GET /api/categories/admin`
- **Access**: Admin only (`Authorization: Bearer <token>`, role: `admin`)
- **Description**: Returns categories (both active and inactive) with aggregated service counts, pagination, and status filters.
- **Query Parameters**:
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 20): Results per page (max 100).
  - `search` (string, optional): Keyword search against name, slug, or description.
  - `status` (`active` | `inactive`, optional): Filter by active state.
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Admin categories retrieved successfully",
  "data": [
    {
      "_id": "67096e2a865f1a3089d7fa11",
      "name": "Plumbing Services",
      "slug": "plumbing-services",
      "description": "Licensed plumbing solutions",
      "icon": "Wrench",
      "image": null,
      "isActive": true,
      "displayOrder": 1,
      "servicesCount": 4,
      "createdAt": "2026-10-11T14:30:00.000Z",
      "updatedAt": "2026-10-11T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

### `GET /api/categories/:id`
- **Access**: Public / Authenticated
- **Description**: Retrieve a single category's details by MongoDB ObjectId.
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "_id": "67096e2a865f1a3089d7fa11",
    "name": "Plumbing Services",
    "slug": "plumbing-services",
    "description": "Licensed plumbing solutions",
    "icon": "Wrench",
    "image": null,
    "isActive": true,
    "displayOrder": 1,
    "servicesCount": 4
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Invalid ObjectId format.
  - `404 Not Found`: Category does not exist.

---

### `POST /api/categories`
- **Access**: Admin only
- **Description**: Create a new category.
- **Request Body**:
```json
{
  "name": "Electrical Repairs",
  "slug": "electrical-repairs", 
  "description": "Wiring, installation, and electrical diagnostics",
  "icon": "Zap",
  "image": null,
  "isActive": true,
  "displayOrder": 2
}
```
*Note: If `slug` is omitted, a normalized kebab-case slug is generated automatically. Conflicting slugs are assigned numerical suffixes (e.g. `electrical-repairs-1`).*
- **Success Response** (`201 Created`):
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { ... }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (empty name, name > 100 chars, negative display order).
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: Non-admin role or deactivated account.
  - `409 Conflict`: Category with identical name already exists.

---

### `PUT /api/categories/:id`
- **Access**: Admin only
- **Description**: Update an existing category.
- **Request Body**:
```json
{
  "name": "Electrical & Wiring",
  "description": "Updated service description",
  "displayOrder": 3,
  "isActive": true
}
```
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": { ... }
}
```
- **Error Responses**:
  - `400 Bad Request`: Invalid ID or payload.
  - `404 Not Found`: Category not found.
  - `409 Conflict`: New name conflicts with another category.

---

### `PATCH /api/categories/:id/status`
- **Access**: Admin only
- **Description**: Fast activation / deactivation toggle.
- **Request Body**:
```json
{
  "isActive": false
}
```
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Category deactivated successfully",
  "data": { ... }
}
```

---

### `DELETE /api/categories/:id`
- **Access**: Admin only
- **Description**: Safe deletion of a category. Refuses deletion if referenced by any existing `Service` documents to preserve data integrity.
- **Success Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Category 'Electrical Repairs' deleted successfully",
  "data": {
    "deletedId": "67096e2a865f1a3089d7fa11",
    "name": "Electrical Repairs"
  }
}
```
- **Conflict Response** (`409 Conflict`):
```json
{
  "success": false,
  "error": {
    "message": "Cannot delete category 'Plumbing Services' because it is currently referenced by 4 service(s). Deactivate the category instead or reassign the services.",
    "statusCode": 409,
    "timestamp": "2026-10-11T15:00:00.000Z"
  }
}
```
