# Admin Panel — Wallets & Payouts Redesign Report

**Date:** November 2, 2026  
**Project:** `SERVICE-PROVIDER-MARKETPLACE`  
**Target:** `admin-panel/src/pages/wallets/WalletsPage.jsx`  
**Backend:** `backend/src/services/walletService.js`  

---

## 1. Executive Summary

The Admin Panel **Wallets & Payouts** interface has been completely redesigned into a modern, SaaS-grade financial operations dashboard modeled after industry standards (Stripe, Mercury, Brex). The redesign eliminates harsh contrasts and decorative gimmicks, bringing full alignment with the application's clean design system, subtle borders (`border-slate-200`), crisp typography, and disciplined operational workflows.

---

## 2. Key Implementations & Enhancements

### 2.1 Dashboard Summary Cards (4 Financial KPIs)
- **Total Available Liability:** Shows live platform obligations to active providers formatted with Indian numbering (`₹` + `en-IN`, e.g. `₹580.00`).
- **Pending Withdrawals:** Real-time funds locked in active payout requests awaiting review and disbursal.
- **Total Disbursed:** Lifetime cumulative bank and UPI settlements transferred to providers.
- **Lifetime Net Earnings:** Total platform net earnings credited to providers across all completed bookings.
- **Styling:** Restrained white cards (`bg-white border border-slate-200 rounded-xl p-5 shadow-xs`) with subtle icon accents and secondary explanatory captions.

---

### 2.2 Withdrawal Requests Table
- **Columns:**
  1. `Reference ID`: Monospace font, e.g. `WDR-965978-7371`, with one-click copy to clipboard.
  2. `Provider`: Bold business/trade name, contact person name, and phone/email in muted secondary text.
  3. `Amount`: Bold formatted currency (`₹{amount.toLocaleString('en-IN')}`).
  4. `Payout Method`: Subtle badge with `Building` (Bank Transfer) or `CreditCard` (UPI) icon.
  5. `Payout Details`: Bank account holder name, masked account number (`•••• •••• 7371`), IFSC code, or UPI ID.
  6. `Status`: Clean semantic status pills with indicator dots (`Requested`, `Approved`, `Paid`, `Rejected`).
  7. `Request Date`: Clear date and 12-hour timestamp formatting.
  8. `Actions`:
     - **For `requested` status (Strict Order):** `[View]` `[Approve]` `[Reject]`
       - `[View]`: Neutral outlined button with `Eye` icon (`border-slate-300 bg-white hover:bg-slate-50 text-slate-700`).
       - `[Approve]`: Clean green button with `Check` icon (`bg-emerald-600 hover:bg-emerald-500 text-white`).
       - `[Reject]`: Subtle red outlined button with `X` icon (`bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100`).
     - **For `approved` status:** `[View]` `[Pay / Disburse]` `[Reject]`
     - **For `paid` status:** `[View]` + UTR reference tag.
     - **For `rejected` status:** `[View]` + rejection reason snippet.

---

### 2.3 Comprehensive Withdrawal Details View Modal
Triggered when clicking `[View]` on any request:
- **Header:** Reference ID (with copy), current status badge, and close control (`X`).
- **Section A: Financial Overview:** Large requested amount, formatted request date/time, payout method.
- **Section B: Provider Account Information:** Business name, MongoDB Provider ID (with copy), contact name, registered phone and email.
- **Section C: Payout Destination Coordinates:**
  - If Bank Transfer: Account Holder Name, Bank Name, IFSC Code (with copy), and Bank Account Number.
  - **Security Account Masking:** Bank account number is masked by default (`•••• •••• 7371`). Clicking **Reveal** displays the full account number with a copy button; clicking **Hide** re-masks it.
  - **Security Standard:** Unmasked account number is kept strictly in component state during the active modal session. It is never stored in `localStorage`, `sessionStorage`, or window objects.
  - If UPI: UPI Virtual Payment Address (VPA) with one-click copy.
- **Section D: Provider Wallet Ledger Snapshot:** Live display of Provider Wallet ID, Available Balance, Pending Payout, Lifetime Earnings, and Total Withdrawn.
- **Section E: Lifecycle & Audit Timeline:** 3-step audit progress (Initiated by provider → Administrative review/approval → Bank disbursal with UTR reference).
- **Modal Actions:** Quick action buttons to directly Approve, Reject, or Disburse from within the modal without returning to the table.

---

### 2.4 Approval, Disbursal & Rejection Modals
- **Approval Confirmation Modal:** Confirms provider name, amount, and reference; explains that funds remain safely locked in Pending Withdrawals; includes optional admin note.
- **Payout Disbursal Modal:** Requires mandatory Bank UTR or Transaction Reference ID; records administrative notes; completes payout and deducts pending liabilities.
- **Rejection Modal:** Prominently warns about the atomic refund of funds back to the provider's available balance; enforces a mandatory rejection reason (minimum 4 characters).
- **Balance Adjustment Modal:** Preserved in Tab 2 for auditing manual credit/debit adjustments on provider ledgers.

---

### 2.5 Filters, Search & Sorting
- **Status Filter Pills:** `All Requests`, `Requested`, `Approved`, `Paid`, `Rejected` with live count badges.
- **Search Input:** Real-time search across Reference ID, Provider Business Name, Provider ID, Account Holder Name, and UPI ID.
- **Sort Options:**
  - Date: Newest First / Oldest First.
  - Amount: High to Low / Low to High.

---

## 3. Verification & Testing

| Test Case | Description | Result |
| :--- | :--- | :--- |
| **TC-01** | 4 Financial KPI Summary Cards formatted with `₹` and `en-IN` | **PASSED** |
| **TC-02** | Withdrawals Table: columns, monospace reference, masked accounts | **PASSED** |
| **TC-03** | Exact Action Button Order: `[View] [Approve] [Reject]` (`View` before `Approve`) | **PASSED** |
| **TC-04** | View Modal: Sections A-E, copy buttons, live wallet snapshot, audit timeline | **PASSED** |
| **TC-05** | Account Number Mask/Reveal toggle with strict state-only retention | **PASSED** |
| **TC-06** | Approval Modal & Payout Disbursal Modal (mandatory UTR validation) | **PASSED** |
| **TC-07** | Rejection Modal (mandatory reason & atomic refund notice) | **PASSED** |
| **TC-08** | Production Vite Build (`npm --prefix admin-panel run build`) | **PASSED (3.08s, 0 errors)** |
| **TC-09** | Backend Wallet Regression Test Suite (`test_withdrawal_regression.js`) | **PASSED (5/5 suites)** |

---

## 4. Conclusion
The Wallets & Payouts page is fully deployed, cleanly styled to match the Admin Panel's design language, and ready for production operation.
