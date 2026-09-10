-- Stage 2, slice 2: control-account tagging.
--
-- Marks which Chart-of-Accounts rows play a structural role in automatic
-- postings (Accounts Receivable, Accounts Payable, Cash/Bank), instead of
-- app code guessing by account name. At most one account can be tagged
-- 'accounts_receivable' and at most one 'accounts_payable'; any number can
-- be tagged 'cash_or_bank' (e.g. separate checking/savings).
--
-- Safe to run more than once.

BEGIN;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS system_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_system_role_check'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_system_role_check
      CHECK (system_role IN ('accounts_receivable', 'accounts_payable', 'cash_or_bank'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_ar_unique
  ON accounts ((system_role)) WHERE system_role = 'accounts_receivable';

CREATE UNIQUE INDEX IF NOT EXISTS accounts_ap_unique
  ON accounts ((system_role)) WHERE system_role = 'accounts_payable';

COMMIT;
