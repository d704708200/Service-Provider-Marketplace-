# Provider Management, Document Upload & Verification Guide

## 1. Overview
This document specifies the contractor onboarding, document verification lifecycle, security controls, and admin verification queue implemented in Phase 8 for the **Service Provider Marketplace**.

---

## 2. Document & Provider Verification Lifecycle

### State Machine

```
Provider Registration:
  POST /api/auth/register/provider
    → Creates User (role: 'provider', isVerified: false, isActive: true)
    → Creates Provider (verificationStatus: 'pending', documents: [])

Document Submission:
  POST /api/providers/me/documents
    → Document State: 'pending'
    → Uploaded document types: identity | address | certificate | license | other

Admin Review:
  PATCH /api/providers/admin/:id/documents/:docId/status
    → Document State: 'approved' | 'rejected' (rejection requires reviewNote)

Provider Verification Decision:
  PATCH /api/providers/admin/:id/verification
    ├── 'verified': Sets Provider verificationStatus = 'verified', User isVerified = true, verifiedAt = Date.now(). Automatically approves pending documents.
    ├── 'rejected': Sets Provider verificationStatus = 'rejected', records rejectionReason.
    └── 'suspended': Sets Provider verificationStatus = 'suspended', records reason.

Resubmission Workflow:
  POST /api/providers/me/documents
    → Provider uploads corrected document.
    → Document state resets to 'pending', reviewNote is cleared.
    → If Provider was 'rejected', Provider status resets to 'pending' to re-enter the admin review queue.
```

---

## 3. Supported Document Types

| Document Type | Description | Mandatory For Marketplace Onboarding |
| :--- | :--- | :--- |
| `identity` | Government ID, Passport, Driver's License | Yes |
| `address` | Utility bill, residential proof, or lease contract | Yes |
| `certificate` | Trade certification or apprenticeship credential | Recommended |
| `license` | Professional contractor or municipal trade license | Mandatory for regulated trades |
| `other` | Supplementary certifications, insurance certificates | Optional |

---

## 4. Public Marketplace Discovery Invariant

A provider **ONLY** appears in public discovery endpoints (`GET /api/providers`, `GET /api/providers/:id`) when **BOTH** conditions are met:
1. Provider `verificationStatus === 'verified'`
2. Associated User `isActive === true`

- **Pending providers**: Hidden from public view.
- **Rejected providers**: Hidden from public view; allowed to resubmit documents.
- **Suspended providers**: Hidden from public view; access suspended by administrator.
- **Private documents & credentials**: Stripped from all public responses.

---

## 5. Security & Ownership Rules

- **Strict Provider Ownership**:
  - `GET /api/providers/me` and `PUT /api/providers/me` enforce that a provider can only access and modify their own record.
  - Providers cannot modify `role`, `verificationStatus`, `rating`, `reviewCount`, `completedBookingsCount`, `rejectionReason`, or `isActive` (HTTP `403 Forbidden` returned on tampering).
- **Admin Verification Control**:
  - Only users with `role: 'admin'` can approve, reject, or suspend verifications or individual documents.
- **Category Validation**:
  - Providers may only associate active categories. Linking an inactive category is rejected with HTTP `400 Bad Request`.

---

## 6. Document Storage & Upload Boundary

- Document URLs are validated server-side to ensure well-formed HTTP/HTTPS addresses and reasonable size/character bounds.
- Cloudinary environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are present in `.env` as an optional storage service boundary. When configured with live credentials, direct signed uploads can be stored to cloud storage. Validated storage URLs are accepted and persisted securely.

---

## 7. Verification Test Suites

```bash
# From backend directory:
npm run test:providers    # Runs both offline unit tests and live Atlas integration tests
npm test                  # Runs core backend test suites
```
