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

`journal_entries.voided_at`/`voided_by` are informational only — they
mark that an entry was later reversed (and stop it being voided twice)
but are never used to filter journal-based reports (Trial Balance, P&L,
Balance Sheet, General Ledger). Voiding posts a new offsetting entry
rather than editing/deleting the original, so both entries must stay
counted for reports to stay period-accurate and keep balancing — see
`lib/reports/journalFilters.ts` and `lib/voidTransaction.ts`. This is
different from `expenses`/`income`/`payments`/`credit_notes`, whose own
`voided_at` *is* used to filter the operational reports that read those
tables directly (AR/AP Aging, Sales/Expense/Income reports) — those
have no complementary reversal row of their own, so excluding a voided
one there is the correct, safe behavior rather than the same trap.

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

  Account 4900 is `type = 'revenue'` (so `computeNetIncome` can find it
  in the same account-type bucket as real revenue) but must never be
  directly selectable as an invoice's revenue account or an income
  category — the only things allowed to post to it are `issueCreditNote`
  (always a debit) and that credit note's own void reversal (always a
  matching credit). Every query that lists "revenue accounts" for a
  dropdown or validates one server-side — `app/(app)/invoices/page.tsx`,
  `app/(app)/invoices/actions.ts`, `app/(app)/income/page.tsx`,
  `app/(app)/income/actions.ts` — filters it out with `code != '4900'`.
  If a stray invoice or income entry ever does target 4900 (e.g. picked
  before this filter existed), it posts a bare credit with no offsetting
  debit, which `computeNetIncome`'s `debit - credit` for code 4900 reads
  as a negative "returns" — and subtracting a negative return from gross
  sales displays as addition on the P&L (`netRevenue = grossSales -
  returns`). Found 2026-09-11 from exactly that symptom; existing bad
  entries aren't cleaned up by this filter — they still need to be
  identified (journal_lines joined to accounts where code='4900', filtered
  to source_type NOT IN ('credit_note','void')) and voided by hand.
- `009_expense_due_date.sql` — adds `expenses.due_date` (nullable),
  used only by AP Aging (Stage 3). Bills with no due date are aged by
  `expense_date` instead.
- `010_settings.sql` — creates `business_settings` (a singleton row,
  id always 1) and adds a `manage_settings` permission, owner_admin
  only. Holds business name/contact/address and the invoice-number
  prefix. Changing the prefix only affects invoices created after the
  change — `invoices.invoice_number` is a fixed string written once at
  creation, never recomputed from this table, so existing invoice
  numbers are untouched by design.
- `011_void_transactions.sql` — adds `voided_at`/`voided_by` to
  expenses, income, payments, and credit_notes (invoices reuse their
  existing `status = 'void'`), and a new `void_transactions`
  permission granted only to owner_admin and accountant_staff —
  deliberately not family_member, and deliberately separate from
  `manage_transactions` since voiding is more sensitive than creating.
  Voiding an invoice or an on-credit expense that was later paid off
  is blocked until its payments/credit notes are voided first — see
  `lib/voidTransaction.ts` and each entity's `void*` action for why.

No new migration for this one, but worth documenting: **range-based
reports have no opening balance, so a void whose original transaction
falls outside the range can make an account's period subtotal look
one-sided.** A void posts its reversal dated the day the void happened,
never the original transaction's date (see `voided_at`/`voided_by`
note above and `lib/voidTransaction.ts`). Trial Balance, Balance Sheet,
and General Ledger are immune to this: the first two are "as of" with
no lower date bound, so a void pair always resolves once `asOf` is on
or after the void date, and General Ledger carries an explicit opening
balance into the period, so a pre-range original is already folded in.
Profit & Loss — and the Dashboard's period tiles and 6-month trend,
which reuse the same `journalLinesInRange` + `computeNetIncome`
pattern — have neither, because a P&L-type account isn't supposed to
carry a balance between periods by definition. So if a transaction is
voided and its original date falls outside the report's range (before
start *or* after end — e.g. a future-dated test entry voided today),
that range will show only the reversal's side: a lone debit or credit
with no offsetting line, which can read as a sign bug even though the
subtotal is arithmetically correct for what actually happened inside
that range. `lib/reports/crossPeriodAdjustments.ts` detects this (void
reversal inside the range, its original's `entry_date NOT BETWEEN`
start and end) and `app/(app)/reports/CrossPeriodAdjustmentsNote.tsx`
surfaces it on Profit & Loss and the Dashboard instead of leaving the
one-sided figure unexplained.
