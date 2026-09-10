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
🚧 In progress — Stage 1: foundation (Chart of Accounts, journal engine, auth)
