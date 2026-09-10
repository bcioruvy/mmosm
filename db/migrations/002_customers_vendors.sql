-- Stage 2, slice 1: Customers & Vendors.
-- Master data only — no journal entries of their own. Safe to run more
-- than once.

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendors (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
