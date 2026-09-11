# mmosm Accounting

Family e-commerce accounting system for mmosm — double-entry bookkeeping,
multi-user login with roles/permissions, invoicing, expenses, income, and
financial reports (P&L, Balance Sheet, Trial Balance).

## Stack
- Next.js (App Router)
- Neon Postgres (via Vercel Storage)
- Auth.js (NextAuth, Credentials provider)
- Raw SQL (no ORM migrations — schema applied via Neon's SQL editor)

## Status
🚧 In progress — Stages 1-4 done: auth/roles/permissions, Chart of
Accounts and user management, customers/vendors, expenses/income,
invoicing, payments, refunds/credit notes, all financial and
operational reports (Trial Balance, P&L, Balance Sheet, General
Ledger, AR/AP Aging, Sales/Expense/Income), the brand-themed UI shell,
Settings, the audit trail viewer, and the Dashboard. Next up: Stage 5
(Products/inventory scaffolding — schema and basic CRUD only, no
inventory valuation/COGS automation).
