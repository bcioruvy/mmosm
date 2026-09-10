-- Stage 2, slice 5: Sales / Invoicing.
--
-- invoice_number is auto-generated (INV-00001, INV-00002, ...) off a
-- single global sequence — no per-year reset. Easy to change later if
-- you'd rather have a different numbering scheme; it's only referenced
-- in this migration and in app/invoices/actions.ts.
--
-- Draft invoices don't touch the ledger — journal_entry_id stays null
-- until "Send" posts Dr Accounts Receivable / Cr the invoice's revenue
-- account (agreed 2026-09-10). Line items reference no product table
-- (free-text description) since Products/inventory is Stage 5.
--
-- Safe to run more than once.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE TABLE IF NOT EXISTS invoices (
  id bigserial PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  customer_id bigint NOT NULL REFERENCES customers(id),
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'void')),
  revenue_account_id integer NOT NULL REFERENCES accounts(id),
  notes text,
  journal_entry_id integer REFERENCES journal_entries(id),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id bigserial PRIMARY KEY,
  invoice_id bigint NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  line_total numeric(12,2) NOT NULL
);

COMMIT;
