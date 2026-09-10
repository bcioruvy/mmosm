-- Stage 2, slice 3: Expenses.
--
-- Column types match the real live schema confirmed 2026-09-10:
-- accounts.id, users.id, journal_entries.id are all `integer`;
-- vendors.id is `bigint` (it's a table this project created, in
-- 002_customers_vendors.sql, as bigserial).
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS expenses (
  id bigserial PRIMARY KEY,
  expense_date date NOT NULL,
  vendor_id bigint REFERENCES vendors(id),
  category_account_id integer NOT NULL REFERENCES accounts(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'unpaid')),
  payment_account_id integer REFERENCES accounts(id),
  notes text,
  journal_entry_id integer NOT NULL REFERENCES journal_entries(id),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_payment_account_matches_status CHECK (
    (payment_status = 'paid' AND payment_account_id IS NOT NULL) OR
    (payment_status = 'unpaid' AND payment_account_id IS NULL)
  )
);

COMMIT;
