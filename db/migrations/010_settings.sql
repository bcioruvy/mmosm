-- Stage 4, batch 2: Settings.
--
-- Singleton table (id is always 1) for business name/contact/address
-- and the invoice-number prefix. Owner_admin only, via a new
-- manage_settings permission.
--
-- IMPORTANT: invoice_number on `invoices` is stored as a fixed, fully
-- formatted string at creation time (see the INSERT in
-- app/(app)/invoices/actions.ts) — it is never reconstructed from
-- invoice_prefix at display time. Changing invoice_prefix here only
-- changes what gets written into *new* invoices going forward;
-- existing invoice_number values are never read from or written by
-- this table, and this migration does not touch the invoices table
-- at all. Confirmed explicitly per 2026-09-11 conversation — do not
-- "fix" this later by deriving displayed numbers from settings.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS business_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'mmosm Accounting',
  contact_email text,
  contact_phone text,
  address text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

INSERT INTO business_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

UPDATE roles SET permissions = array_append(permissions, 'manage_settings')
WHERE name = 'owner_admin' AND NOT ('manage_settings' = ANY(permissions));

COMMIT;
