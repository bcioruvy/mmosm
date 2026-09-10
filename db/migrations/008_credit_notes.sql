-- Stage 2, slice 7: Refunds / credit notes.
--
-- Adds the "Sales Returns & Allowances" contra-revenue account (code
-- 4900, agreed 2026-09-10) so refunds show up separately on the P&L
-- instead of netting silently against Revenue.
--
-- Scope: credit notes are issued against a specific invoice that has
-- already been sent (draft invoices have nothing to reverse; void ones
-- aren't eligible). Two modes, chosen per credit note:
--   - "apply_to_balance": reduces what's still owed (Dr returns
--     account, Cr Accounts Receivable) — capped at the invoice's
--     remaining balance.
--   - "refund_cash": pays cash back to the customer (Dr returns
--     account, Cr the chosen cash/bank account) — capped at what's
--     actually been paid on the invoice so far.
-- Vendor-side refunds (a vendor refunding an on-credit expense) are
-- NOT built here — deferred, not silently dropped; flag if you want it.
--
-- Safe to run more than once.

BEGIN;

INSERT INTO accounts (code, name, type, is_active)
VALUES ('4900', 'Sales Returns & Allowances', 'revenue', true)
ON CONFLICT (code) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS credit_note_number_seq;

CREATE TABLE IF NOT EXISTS credit_notes (
  id bigserial PRIMARY KEY,
  credit_note_number text NOT NULL UNIQUE,
  invoice_id bigint NOT NULL REFERENCES invoices(id),
  credit_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text,
  refund_account_id integer REFERENCES accounts(id),
  journal_entry_id integer NOT NULL REFERENCES journal_entries(id),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON credit_notes (invoice_id);

COMMIT;
