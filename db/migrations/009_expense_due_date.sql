-- Stage 3, batch 3: AP aging needs a due date for on-credit bills.
-- Nullable, optional — aging falls back to expense_date when it's blank.
--
-- Safe to run more than once.

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS due_date date;

COMMIT;
