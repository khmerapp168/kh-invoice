/*
# Supplier Debts (Accounts Payable)

## Purpose
Tracks money the business owes to suppliers for purchased materials/stock —
separate from the existing income/expense transactions. Lets a shop record
"bought materials from Shop X, total $Y, paid $Z so far" and see running
totals per supplier, so an owner/manager can quickly check what's still owed.

## New Table
### supplier_debts
- id (uuid PK)
- user_id (uuid, not null, default auth.uid()) — owner, FK -> auth.users, cascade
- supplier_name (text, not null) — the shop/supplier name
- item_description (text, nullable) — what was purchased
- total_amount (numeric, not null, must be >= 0) — total cost of the purchase
- paid_amount (numeric, not null, default 0, must be >= 0) — how much has been paid so far
- currency (text, not null, default 'USD', check in ('USD','KHR'))
- purchase_date (date, not null, default current_date)
- note (text, nullable)
- created_at (timestamptz, default now())

## Security (RLS)
4 owner-scoped policies (select/insert/update/delete), TO authenticated, auth.uid() = user_id.

## Indexes
idx_supplier_debts_user on supplier_debts(user_id, purchase_date)
*/

CREATE TABLE IF NOT EXISTS supplier_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  item_description text,
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'KHR')),
  purchase_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_debts_user ON supplier_debts(user_id, purchase_date);

ALTER TABLE supplier_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_supplier_debts" ON supplier_debts;
CREATE POLICY "select_own_supplier_debts" ON supplier_debts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_supplier_debts" ON supplier_debts;
CREATE POLICY "insert_own_supplier_debts" ON supplier_debts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_supplier_debts" ON supplier_debts;
CREATE POLICY "update_own_supplier_debts" ON supplier_debts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_supplier_debts" ON supplier_debts;
CREATE POLICY "delete_own_supplier_debts" ON supplier_debts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
