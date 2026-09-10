-- Stage 2, slice 6: Payments.
--
-- One shared table for both directions: invoice receipts ('in') and
-- bill/on-credit-expense payments ('out'). applied_to_id is polymorphic
-- (points at invoices.id or expenses.id depending on applied_to_type) —
-- both are bigint (bigserial), so a plain bigint column works for either.
--
-- Scope note: invoices already support partial payment (their status
-- enum has 'partial'); on-credit expenses are pay-in-full only — the
-- expenses.payment_status enum is still just paid/unpaid, unchanged by
-- this migration. Adding partial bill payments later is a small,
-- self-contained follow-up if you want it, not a redesign.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS payments (
  id bigserial PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  payment_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  account_id integer NOT NULL REFERENCES accounts(id),
  applied_to_type text NOT NULL CHECK (applied_to_type IN ('invoice', 'expense')),
  applied_to_id bigint NOT NULL,
  notes text,
  journal_entry_id integer NOT NULL REFERENCES journal_entries(id),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_applied_to_idx ON payments (applied_to_type, applied_to_id);

COMMIT;
