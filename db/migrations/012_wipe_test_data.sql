-- One-time data wipe (not a schema change) — requested 2026-09-11 to
-- clear all test data before real use.
--
-- Wipes, unconditionally, everything voided or not: audit_log,
-- journal_lines, journal_entries, credit_notes, payments,
-- invoice_lines, invoices, expenses, income, customers, vendors.
-- Also resets every affected id sequence (via pg_get_serial_sequence,
-- not a guessed name) and the two named sequences (invoice_number_seq,
-- credit_note_number_seq) so new records start clean.
--
-- Does NOT touch, anywhere in this file: accounts (Chart of Accounts,
-- including account 4900 added by 008_credit_notes.sql — that's
-- structure, not test data), users, roles (so roles.permissions is
-- untouched), or business_settings. Grep this file for those four
-- names if you want to verify that yourself before running it — none
-- of them appear as the target of a DELETE, UPDATE, or TRUNCATE.
--
-- DELETE order matters and is FK-derived, not arbitrary — each table
-- below is deleted only after every table with a foreign key pointing
-- *into* it has already been cleared:
--   credit_notes.invoice_id -> invoices, credit_notes.journal_entry_id -> journal_entries
--   payments.journal_entry_id -> journal_entries
--   invoice_lines.invoice_id -> invoices (ON DELETE CASCADE — deleted
--     explicitly anyway, ahead of invoices, so nothing here relies on
--     that cascade actually firing)
--   invoices.customer_id -> customers, invoices.journal_entry_id -> journal_entries
--   expenses.vendor_id -> vendors, expenses.journal_entry_id -> journal_entries
--   income.journal_entry_id -> journal_entries
--   journal_lines.entry_id -> journal_entries
-- (payments.applied_to_id is a polymorphic bigint with no FK constraint
-- — confirmed against 007_payments.sql, which only indexes it — so it
-- imposes no ordering requirement of its own.)
--
-- Wrapped in one transaction: if anything here fails (e.g. a
-- constraint this file didn't anticipate), everything rolls back
-- rather than leaving a partially-wiped database.
--
-- Not idempotent in the sense every other migration here is — running
-- it a second time is harmless (every DELETE matches zero rows, every
-- setval just re-sets to 1), but there's no reason to.

BEGIN;

DELETE FROM audit_log;
DELETE FROM journal_lines;
DELETE FROM credit_notes;
DELETE FROM payments;
DELETE FROM invoice_lines;
DELETE FROM invoices;
DELETE FROM expenses;
DELETE FROM income;
DELETE FROM journal_entries;
DELETE FROM customers;
DELETE FROM vendors;

-- Per-table id sequences, resolved by Postgres itself rather than a
-- guessed name (handles both classic `serial`/`bigserial` and identity
-- columns). If any one of these errors with "sequence ... does not
-- exist", stop and tell me which table — it means that id column isn't
-- sequence-backed the way the others are, which would be worth
-- understanding rather than working around.
SELECT setval(pg_get_serial_sequence('audit_log', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('journal_lines', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('credit_notes', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('payments', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('invoice_lines', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('invoices', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('expenses', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('income', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('journal_entries', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('customers', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('vendors', 'id'), 1, false);

-- Named sequences (not per-column identities): invoice numbering
-- (006_invoicing.sql) and credit note numbering (008_credit_notes.sql).
SELECT setval('invoice_number_seq', 1, false);
SELECT setval('credit_note_number_seq', 1, false);

COMMIT;
