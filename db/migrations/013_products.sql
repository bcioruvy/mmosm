-- Stage 5: Products (catalog scaffolding only).
--
-- Deliberately just a catalog: sku/name/description/default_price/
-- is_active. No quantity_on_hand or any stock column — a number never
-- updated by a real movement/adjustment flow is worse than no number,
-- and that's genuine inventory tracking, a separate feature from this
-- scaffolding. No inventory valuation, no automatic COGS postings from
-- a sale. default_price is a convenience prefill only (used by the
-- invoice line editor) — nothing downstream treats it as a source of
-- truth, and changing it never touches existing invoice_lines rows.
--
-- Invoice line items still don't reference products by FK — they stay
-- free-text/numbers on invoice_lines exactly as before (see
-- 006_invoicing.sql). The line editor gets an optional product picker
-- that prefills description/unit price; that's a UI convenience, not a
-- schema relationship.
--
-- manage_products is its own permission (not folded into
-- manage_customers or manage_transactions), granted to all three roles
-- — products are master data like a customer or vendor record, not a
-- sensitive financial action.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS products (
  id bigserial PRIMARY KEY,
  sku text UNIQUE,
  name text NOT NULL,
  description text,
  default_price numeric(12,2) CHECK (default_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

UPDATE roles SET permissions = array_append(permissions, 'manage_products')
WHERE name IN ('owner_admin', 'accountant_staff', 'family_member')
  AND NOT ('manage_products' = ANY(permissions));

COMMIT;
