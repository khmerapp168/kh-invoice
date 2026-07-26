/*
# Customers and Transaction Categories

## Purpose
Adds two missing features:
1. Customer management — a dedicated `customers` table so the app can store customer profiles (name, phone, address, note) separately from invoices, then link invoices to a customer by ID.
2. Transaction categories — a `transaction_categories` table so income/expense transactions can be tagged with a category (rent, electricity, salary, marketing, etc.) for expense-by-category breakdown in reports.

## New Tables
### customers
- id (uuid PK), user_id (owner, default auth.uid()), name, phone, address, note, created_at
### transaction_categories
- id (uuid PK), user_id (owner, default auth.uid()), name, type (income|expense), color, created_at, unique(user_id,name,type)

## Modified Tables
### transactions
- Added category_id (uuid nullable, FK -> transaction_categories ON DELETE SET NULL)
### invoices
- Added customer_id (uuid nullable, FK -> customers ON DELETE SET NULL)

## Security
- RLS enabled on both new tables with 4 owner-scoped policies each (TO authenticated, auth.uid() = user_id).

## Notes
1. New columns nullable so existing rows/insert paths keep working.
2. ON DELETE SET NULL on both FKs — deleting a customer/category unlinks but does not delete transactions/invoices.
*/

-- ============ customers ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  address text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ transaction_categories ============
CREATE TABLE IF NOT EXISTS transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_transaction_categories_user ON transaction_categories(user_id, type);

ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transaction_categories" ON transaction_categories;
CREATE POLICY "select_own_transaction_categories" ON transaction_categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transaction_categories" ON transaction_categories;
CREATE POLICY "insert_own_transaction_categories" ON transaction_categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transaction_categories" ON transaction_categories;
CREATE POLICY "update_own_transaction_categories" ON transaction_categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transaction_categories" ON transaction_categories;
CREATE POLICY "delete_own_transaction_categories" ON transaction_categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ add category_id to transactions ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'transactions' AND column_name = 'category_id') THEN
    ALTER TABLE transactions
      ADD COLUMN category_id uuid REFERENCES transaction_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- ============ add customer_id to invoices ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'invoices' AND column_name = 'customer_id') THEN
    ALTER TABLE invoices
      ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
