-- Void/reverse transactions.
--
-- Invoices need no new column — status already has 'void' in its CHECK
-- constraint (added in Stage 2 anticipating this). Expenses, income,
-- payments, and credit notes have no existing status concept to
-- repurpose, so they each get voided_at/voided_by, mirroring the
-- pattern journal_entries has had since Stage 1.
--
-- Voiding is gated by a new void_transactions permission, deliberately
-- separate from manage_transactions and granted only to owner_admin and
-- accountant_staff — not family_member, per 2026-09 conversation:
-- voiding is more sensitive than creating and should require a step up
-- in trust even though the same roles can do both elsewhere in the app.
--
-- Safe to run more than once.

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id);

ALTER TABLE income ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE income ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id);

ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS voided_by integer REFERENCES users(id);

UPDATE roles SET permissions = array_append(permissions, 'void_transactions')
WHERE name IN ('owner_admin', 'accountant_staff') AND NOT ('void_transactions' = ANY(permissions));

COMMIT;
