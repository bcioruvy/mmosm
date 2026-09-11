-- Stage follow-up: partial payments for on-credit expenses (bills).
--
-- 007_payments.sql's own header predicted this exact follow-up: invoices
-- already supported partial payment, on-credit expenses were pay-in-full
-- only. This migration closes that gap the same way invoices already
-- work — expenses.payment_status gains a 'partial' state, and how much
-- is still owed is computed live from the payments table (see the new
-- lib/expenseBalance.ts), never stored as a running total.
--
-- Two existing constraints touch payment_status, and both need care:
--
-- 1. The inline `CHECK (payment_status IN ('paid', 'unpaid'))` on the
--    column itself has no name in the CREATE TABLE — Postgres generated
--    one (typically expenses_payment_status_check, but that's exactly
--    the kind of guess this project got burned on before, per
--    004_expenses.sql's and db/README.md's own history). So this
--    migration looks it up via pg_constraint/pg_class/pg_attribute
--    instead of assuming the name, and drops whatever it actually finds.
--
-- 2. `expenses_payment_account_matches_status` (named, so a plain DROP
--    is safe) enforced a strict 1:1 between payment_status and
--    payment_account_id: paid <=> account set, unpaid <=> account null.
--    That relationship no longer holds once bills can be paid off across
--    multiple partial payments, possibly from different accounts — a
--    single FK column can't represent "paid via two different accounts
--    over two payments." So payment_account_id's meaning narrows rather
--    than disappears: it stays exactly as-is for the immediate-pay-at-
--    creation path (still the only record of which account that single
--    payment used — it never posts to Accounts Payable or into the
--    payments table, so there's nothing else to compute a balance from
--    there), and the bill-payment flow (recordExpensePayment,
--    voidPayment's expense branch) stops touching it entirely, relying
--    on the payments table instead, same as invoices already do. The
--    column stays nullable with no CHECK tying it to payment_status.
--
-- Safe to run more than once: the constraint lookups are no-ops once
-- already dropped/renamed, and the new CHECK uses DROP + ADD by name.
--
-- Column types match the rest of the schema (see db/README.md).

BEGIN;

DO $$
DECLARE
  inline_check_name text;
BEGIN
  SELECT con.conname INTO inline_check_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'expenses'
    AND con.contype = 'c'
    AND con.conname <> 'expenses_payment_account_matches_status'
    AND con.conname <> 'expenses_payment_status_check'
    AND pg_get_constraintdef(con.oid) LIKE '%payment_status%'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%payment_account_id%';

  IF inline_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE expenses DROP CONSTRAINT %I', inline_check_name);
  END IF;
END $$;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_account_matches_status;

COMMIT;
