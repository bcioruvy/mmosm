-- Stage 2, slice 4: Income (non-sale).
--
-- Always received immediately — no unpaid/on-credit branch, unlike
-- Expenses (the brief doesn't call for invoicing non-sale income, and
-- adding an AR-style flow for it isn't asked for).
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS income (
  id bigserial PRIMARY KEY,
  income_date date NOT NULL,
  category_account_id integer NOT NULL REFERENCES accounts(id),
  source text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_account_id integer NOT NULL REFERENCES accounts(id),
  notes text,
  journal_entry_id integer NOT NULL REFERENCES journal_entries(id),
  created_by integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
