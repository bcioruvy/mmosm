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
--   * audit_log's column names were originally guessed and got one wrong:
--     the live table uses `actor_id`, not `actor` (confirmed against the
--     real schema after a production 500 on 2026-09-10; lib/audit.ts and
--     the CREATE TABLE below have been corrected to match). This
--     CREATE TABLE is a defensive fallback only — on the already-live DB
--     it was always a no-op, so this correction doesn't need re-running;
--     it's fixed here so a fresh database created from this file matches
--     reality.
--
-- Safe to run more than once.

BEGIN;

-- Chart of Accounts: active/inactive flag. Accounts are deactivated, never
-- deleted (they may be referenced by journal_lines).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Audit log: create only if it doesn't already exist under this name.
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id bigint REFERENCES users(id),
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
