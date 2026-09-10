-- Stage 1 completion: Chart of Accounts management, user management,
-- change password, permission-based route/action protection, audit log
-- wiring.
--
-- ASSUMPTIONS — sanity-check against the live schema before running:
--   * accounts has a primary key column named `id` (code/name/type were
--     already confirmed live by the existing homepage query).
--   * users.id / roles.id / roles.name / roles.permissions / users.role_id
--     / users.is_active / users.password_hash are all already confirmed
--     live (auth.ts already queries them successfully).
--   * audit_log's column names (actor, action, entity_type, entity_id,
--     details, timestamp) are taken as given; the CREATE TABLE below is a
--     defensive fallback only — if the table already exists with these
--     names (as described), it's a no-op. If it exists with *different*
--     column names, the app's lib/audit.ts insert will fail until this
--     migration or lib/audit.ts is adjusted to match reality.
--
-- Safe to run more than once.

BEGIN;

-- Chart of Accounts: active/inactive flag. Accounts are deactivated, never
-- deleted (they may be referenced by journal_lines).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Audit log: create only if it doesn't already exist under this name.
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor bigint REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

-- Permission scheme for role-based route/action protection. This is the
-- first real use of roles.permissions in app code — the strings below are
-- a judgment call, not a pre-agreed standard. Review before relying on it;
-- app code lives in lib/permissions.ts and expects exactly these strings.
UPDATE roles SET permissions = ARRAY[
  'manage_accounts', 'manage_users', 'manage_customers', 'manage_vendors',
  'manage_transactions', 'view_reports', 'view_audit_log'
] WHERE name = 'owner_admin';

UPDATE roles SET permissions = ARRAY[
  'manage_accounts', 'manage_customers', 'manage_vendors',
  'manage_transactions', 'view_reports', 'view_audit_log'
] WHERE name = 'accountant_staff';

UPDATE roles SET permissions = ARRAY[
  'manage_customers', 'manage_vendors', 'manage_transactions', 'view_reports'
] WHERE name = 'family_member';

COMMIT;
