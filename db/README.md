# Database

Schema changes are applied by hand: paste the SQL from `db/migrations/*.sql`
(in order) into Neon's own SQL Editor (not the Vercel-embedded one — it
can't run multi-statement scripts).

There is no `db/schema.sql` snapshot of the live database in this repo yet
— the schema currently only exists in Neon itself. The `roles`, `users`,
`accounts`, `journal_entries`, `journal_lines`, and `audit_log` tables
already exist there (see project notes / prior conversation for the
agreed shape). Until a real snapshot is committed, treat each migration
file's own comments as the source of truth for what it assumes already
exists versus what it's adding.

Recommended next step: run a schema-dump query in Neon's SQL Editor (or
`pg_dump --schema-only` if you ever get shell access to the DB) and commit
the result as `db/schema.sql`, so future changes can diff against a real
baseline instead of against memory.

## Migrations

- `001_stage1_completion.sql` — adds `accounts.is_active`, defensively
  creates `audit_log` if it doesn't already match the assumed shape, and
  seeds `roles.permissions` for the three roles (first real use of that
  column).
