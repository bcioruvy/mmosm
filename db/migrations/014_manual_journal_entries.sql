-- Manual Journal Entries.
--
-- No new table — unlike every other transaction type (expense, income,
-- invoice, ...), a manual journal entry has no business object beyond
-- what journal_entries already stores (date, description, who created
-- it, voided status). It posts with source_type = 'manual' and
-- source_id left NULL; journal_entries.id IS the record. Voiding
-- reuses lib/voidTransaction.ts unchanged — originalEntryId is just
-- the entry's own id, and there's no separate source row to update.
--
-- manage_journal_entries is deliberately scoped to owner_admin only —
-- this bypasses every structural guardrail the built-in flows provide
-- (no account-type restriction, no automatic AR/AP handling), agreed
-- 2026-09-11. Voiding a manual entry reuses the existing
-- void_transactions permission rather than a new one — owner_admin
-- already has both, and accountant_staff (who has void_transactions
-- but not manage_journal_entries) can't reach this feature at all, so
-- there's no gap to cover.
--
-- Safe to run more than once.

BEGIN;

UPDATE roles SET permissions = array_append(permissions, 'manage_journal_entries')
WHERE name = 'owner_admin' AND NOT ('manage_journal_entries' = ANY(permissions));

COMMIT;
