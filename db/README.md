# Database

Schema changes are applied by hand: paste the SQL from `db/migrations/*.sql`
(in order) into Neon's own SQL Editor (not the Vercel-embedded one — it
can't run multi-statement scripts).

There is no `db/schema.sql` snapshot of the live database in this repo yet
— the schema currently only exists in Neon itself. Until a real snapshot
is committed, treat each migration file's own comments as the source of
truth for what it assumes already exists versus what it's adding.

Confirmed against the live DB on 2026-09-10 (via `information_schema`
introspection, after a production bug — see `001_stage1_completion.sql`'s
comments and `004_expenses.sql`'s header):

```
journal_entries: id integer, entry_date date, description text,
  source_type text, source_id integer (nullable), created_by integer,
  created_at timestamptz, voided_at timestamptz (nullable),
  voided_by integer (nullable)
journal_lines: id integer, entry_id integer, account_id integer,
  debit numeric, credit numeric
```

`journal_lines` has a row-level trigger (`check_journal_balance`) that
sums debit/credit per `entry_id` and raises if they don't match — it's
deferred to transaction commit, not checked after each row, so entry +
all lines must be inserted in one DB transaction (see `lib/journal.ts`).
`accounts.id`, `users.id`, and `journal_entries.id` are all `integer`
(not `bigint`) — new tables that reference them use `integer` FK columns
to match.

Recommended next step: run a schema-dump query in Neon's SQL Editor (or
`pg_dump --schema-only` if you ever get shell access to the DB) and commit
the result as `db/schema.sql`, so future changes can diff against a real
baseline instead of against memory.

## Migrations

- `001_stage1_completion.sql` — adds `accounts.is_active`, defensively
  creates `audit_log` if it doesn't already match the assumed shape, and
  seeds `roles.permissions` for the three roles (first real use of that
  column).
- `002_customers_vendors.sql` — creates `customers` and `vendors` (master
  data only, no journal entries of their own).
- `003_control_accounts.sql` — adds `accounts.system_role` so app code can
  find the Accounts Receivable / Accounts Payable / Cash-or-Bank accounts
  by tag instead of guessing by name. At most one account can be tagged
  `accounts_receivable`, at most one `accounts_payable`; any number can be
  `cash_or_bank`. Tag accounts from the Chart of Accounts UI after running
  this.
- `004_expenses.sql` — creates `expenses`. Posts a journal entry on save:
  Dr the chosen expense/COGS category account; Cr the chosen cash/bank
  account if paid immediately, or Cr the tagged Accounts Payable account
  if put "on credit". No edit/void yet — paying off an on-credit expense
  later, and any correction flow, is part of the upcoming Payments and
  Refunds slices.
- `005_income.sql` — creates `income` (non-sale income only). Always
  received immediately: Dr the chosen cash/bank account, Cr the chosen
  revenue category account.
- `006_invoicing.sql` — creates `invoices`/`invoice_lines` and an
  `invoice_number_seq` sequence (numbers as INV-00001, INV-00002, ... —
  no per-year reset; easy to change, only referenced here and in
  app/invoices/actions.ts). Draft invoices don't touch the ledger;
  "Send" posts Dr Accounts Receivable / Cr the invoice's revenue account.
  Line items are free-text (no product table — Stage 5). No edit after
  creation; a draft can be deleted outright (nothing posted yet), a sent
  invoice cannot be changed — corrections are Refunds/credit notes.
- `007_payments.sql` — creates `payments`, shared by both directions:
  invoice receipts (`direction='in'`, `applied_to_type='invoice'`) and
  bill/on-credit-expense payments (`direction='out'`,
  `applied_to_type='expense'`). `applied_to_id` is polymorphic (bigint,
  matches both invoices.id and expenses.id). Invoices support partial
  payment (their status already had a 'partial' state); on-credit
  expenses are pay-in-full only for now — expenses.payment_status is
  still just paid/unpaid, unchanged by this migration.
- `008_credit_notes.sql` — adds account 4900 "Sales Returns &
  Allowances" (contra-revenue, so refunds show separately on the P&L
  instead of netting against Revenue) and creates `credit_notes`
  against a specific invoice. Two modes: "apply_to_balance" (Dr
  returns account, Cr Accounts Receivable, capped at the invoice's
  remaining balance) or "refund_cash" (Dr returns account, Cr a
  chosen cash/bank account, capped at what's actually been paid so
  far). Vendor-side refunds (a vendor refunding an on-credit expense)
  are not built here — deferred, not silently dropped.
