-- ================================================================
-- Lohith Path Labs — LIS Schema v2
-- Run this FULL script in Supabase SQL Editor (safe to re-run)
-- ================================================================

-- Doctors
CREATE TABLE IF NOT EXISTS lis_doctors (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  clinic_name        TEXT,
  phone              TEXT,
  commission_percent NUMERIC DEFAULT 10,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Patients (with all new fields)
CREATE TABLE IF NOT EXISTS lis_patients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code         TEXT UNIQUE NOT NULL,
  title                TEXT,
  full_name            TEXT NOT NULL,
  dob                  DATE,
  age                  INT,
  age_unit             TEXT DEFAULT 'Years',
  gender               TEXT CHECK (gender IN ('M', 'F', 'Other')),
  phone                TEXT NOT NULL,
  alt_phone            TEXT,
  email                TEXT,
  address              TEXT,
  city                 TEXT,
  pincode              TEXT,
  referring_doctor_id  UUID REFERENCES lis_doctors(id),
  notes                TEXT,
  id_proof_type        TEXT,
  id_proof_number      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  created_by           UUID REFERENCES auth.users
);

-- Add new columns to existing table if running on existing DB
DO $$ BEGIN
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS dob DATE;
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS age_unit TEXT DEFAULT 'Years';
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS alt_phone TEXT;
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS pincode TEXT;
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS id_proof_type TEXT;
  ALTER TABLE lis_patients ADD COLUMN IF NOT EXISTS id_proof_number TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Tests catalogue
CREATE TABLE IF NOT EXISTS lis_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code   TEXT UNIQUE NOT NULL,
  test_name   TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  department  TEXT,
  is_active   BOOLEAN DEFAULT true
);

-- Invoices
CREATE TABLE IF NOT EXISTS lis_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number      TEXT UNIQUE NOT NULL,
  patient_id          UUID REFERENCES lis_patients(id) NOT NULL,
  referring_doctor_id UUID REFERENCES lis_doctors(id),
  subtotal            NUMERIC NOT NULL,
  discount_percent    NUMERIC DEFAULT 0,
  gst_applicable      BOOLEAN DEFAULT false,
  gst_amount          NUMERIC DEFAULT 0,
  total_amount        NUMERIC NOT NULL,
  amount_paid         NUMERIC DEFAULT 0,
  payment_mode        TEXT,
  payment_status      TEXT DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS lis_invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID REFERENCES lis_invoices(id) ON DELETE CASCADE,
  test_id     UUID REFERENCES lis_tests(id),
  item_name   TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  quantity    INT DEFAULT 1
);

-- ── Sequences + RPC helpers ──────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS lis_patient_seq START 1;
CREATE SEQUENCE IF NOT EXISTS lis_invoice_seq START 1;

CREATE OR REPLACE FUNCTION next_patient_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE seq INT;
BEGIN
  seq := nextval('lis_patient_seq');
  RETURN 'LPL-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE seq INT;
BEGIN
  seq := nextval('lis_invoice_seq');
  RETURN 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE lis_doctors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_invoice_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_doctors       FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_patients      FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_tests         FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_invoices      FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed: Doctors ─────────────────────────────────────────────────────────────

INSERT INTO lis_doctors (name, clinic_name, phone, commission_percent) VALUES
  ('Dr. Ramesh Kumar',  'Apollo Hospital',  '9876543210', 10),
  ('Dr. Priya Sharma',  'Care Hospital',    '9876543211', 10),
  ('Dr. Suresh Reddy',  'Own Clinic',       '9876543212',  8),
  ('Dr. Anjali Mehta',  'KIMS Hospital',    '9876543213', 12)
ON CONFLICT DO NOTHING;

-- ── Seed: Tests ───────────────────────────────────────────────────────────────

INSERT INTO lis_tests (test_code, test_name, price, department) VALUES
  ('CBC001', 'Complete Blood Count (CBC)',       300,  'Haematology'),
  ('BSF001', 'Blood Sugar Fasting',              100,  'Biochemistry'),
  ('HBA001', 'HbA1c',                            450,  'Biochemistry'),
  ('LIP001', 'Lipid Profile',                    600,  'Biochemistry'),
  ('TSH001', 'Thyroid TSH',                      250,  'Thyroid'),
  ('T3001',  'T3 (Triiodothyronine)',            300,  'Thyroid'),
  ('T4001',  'T4 (Thyroxine)',                   300,  'Thyroid'),
  ('LFT001', 'Liver Function Test (LFT)',        700,  'Biochemistry'),
  ('KFT001', 'Kidney Function Test (KFT)',       600,  'Biochemistry'),
  ('URN001', 'Urine Routine & Microscopy',       150,  'Urine'),
  ('WID001', 'Widal Test',                       250,  'Serology'),
  ('DEN001', 'Dengue NS1 Antigen',               800,  'Serology'),
  ('MAL001', 'Malaria Parasite Test',            200,  'Serology'),
  ('TYP001', 'Typhoid IgM (ELISA)',              500,  'Serology'),
  ('VTD001', 'Vitamin D (25-OH)',               1200,  'Endocrinology'),
  ('VTB001', 'Vitamin B12',                      900,  'Endocrinology'),
  ('IRN001', 'Iron Studies',                    1000,  'Biochemistry'),
  ('ECG001', 'ECG (Electrocardiogram)',          300,  'Cardiology'),
  ('ECH001', 'ECHO (Echocardiography)',         1500,  'Cardiology'),
  ('XRC001', 'X-Ray Chest (PA View)',            400,  'Radiology')
ON CONFLICT DO NOTHING;

-- ── Seed: Sample Patients ────────────────────────────────────────────────────

WITH doc_ids AS (
  SELECT id, name FROM lis_doctors
)
INSERT INTO lis_patients (patient_code, title, full_name, age, gender, phone, city, referring_doctor_id, created_at)
SELECT
  'LPL-2026-' || LPAD(row_number() OVER ()::TEXT, 5, '0'),
  title, full_name, age, gender, phone, city,
  (SELECT id FROM doc_ids WHERE name = doctor_name LIMIT 1),
  created_at
FROM (VALUES
  ('Mr.',   'Mr. Ramesh Kumar',    45, 'M', '9848012345', 'Medak',       'Dr. Ramesh Kumar', NOW() - INTERVAL '5 days'),
  ('Mrs.',  'Mrs. Lakshmi Devi',   38, 'F', '9848023456', 'Hussainpur',  'Dr. Priya Sharma', NOW() - INTERVAL '4 days'),
  ('Ms.',   'Ms. Priya Sharma',    28, 'F', '9848034567', 'Medak',       'Dr. Suresh Reddy', NOW() - INTERVAL '3 days'),
  ('Mr.',   'Mr. Suresh Reddy',    55, 'M', '9848045678', 'Medak',       'Dr. Anjali Mehta', NOW() - INTERVAL '2 days'),
  ('Mrs.',  'Mrs. Anjali Rao',     32, 'F', '9848056789', 'Siddipet',    'Dr. Ramesh Kumar', NOW() - INTERVAL '1 day'),
  ('Mr.',   'Mr. Venkat Rao',      62, 'M', '9848067890', 'Medak',       'Dr. Priya Sharma', NOW() - INTERVAL '12 hours'),
  ('Mrs.',  'Mrs. Sunita Singh',   41, 'F', '9848078901', 'Hyderabad',   'Dr. Suresh Reddy', NOW() - INTERVAL '6 hours'),
  ('Mr.',   'Mr. Rajesh Gupta',    29, 'M', '9848089012', 'Medak',       'Dr. Anjali Mehta', NOW() - INTERVAL '2 hours')
) AS t(title, full_name, age, gender, phone, city, doctor_name, created_at)
ON CONFLICT (patient_code) DO NOTHING;

-- Fix sequence to continue after seed patients
SELECT setval('lis_patient_seq', GREATEST(8, (SELECT COUNT(*) FROM lis_patients)));

-- ── Seed: Sample Invoices ─────────────────────────────────────────────────────

DO $$
DECLARE
  p1 UUID; p2 UUID; p3 UUID;
  t_cbc UUID; t_tsh UUID; t_lft UUID; t_lipid UUID; t_b12 UUID;
  inv1 UUID; inv2 UUID; inv3 UUID;
BEGIN
  SELECT id INTO p1 FROM lis_patients WHERE phone = '9848012345' LIMIT 1;
  SELECT id INTO p2 FROM lis_patients WHERE phone = '9848023456' LIMIT 1;
  SELECT id INTO p3 FROM lis_patients WHERE phone = '9848034567' LIMIT 1;

  SELECT id INTO t_cbc   FROM lis_tests WHERE test_code = 'CBC001';
  SELECT id INTO t_tsh   FROM lis_tests WHERE test_code = 'TSH001';
  SELECT id INTO t_lft   FROM lis_tests WHERE test_code = 'LFT001';
  SELECT id INTO t_lipid FROM lis_tests WHERE test_code = 'LIP001';
  SELECT id INTO t_b12   FROM lis_tests WHERE test_code = 'VTB001';

  IF p1 IS NOT NULL THEN
    INSERT INTO lis_invoices (invoice_number, patient_id, subtotal, total_amount, amount_paid, payment_mode, payment_status, created_at)
    VALUES ('INV-2026-00001', p1, 900, 900, 900, 'cash', 'paid', NOW() - INTERVAL '3 days')
    ON CONFLICT DO NOTHING RETURNING id INTO inv1;
    IF inv1 IS NOT NULL THEN
      INSERT INTO lis_invoice_items (invoice_id, test_id, item_name, price) VALUES
        (inv1, t_cbc,   'Complete Blood Count (CBC)', 300),
        (inv1, t_tsh,   'Thyroid TSH',                250),
        (inv1, t_lft,   'Liver Function Test (LFT)',  700) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF p2 IS NOT NULL THEN
    INSERT INTO lis_invoices (invoice_number, patient_id, subtotal, discount_percent, total_amount, amount_paid, payment_mode, payment_status, created_at)
    VALUES ('INV-2026-00002', p2, 1500, 10, 1350, 1350, 'upi', 'paid', NOW() - INTERVAL '2 days')
    ON CONFLICT DO NOTHING RETURNING id INTO inv2;
    IF inv2 IS NOT NULL THEN
      INSERT INTO lis_invoice_items (invoice_id, test_id, item_name, price) VALUES
        (inv2, t_lipid, 'Lipid Profile', 600),
        (inv2, t_b12,   'Vitamin B12',   900) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF p3 IS NOT NULL THEN
    INSERT INTO lis_invoices (invoice_number, patient_id, subtotal, total_amount, amount_paid, payment_mode, payment_status, created_at)
    VALUES ('INV-2026-00003', p3, 300, 300, 0, 'cash', 'pending', NOW() - INTERVAL '1 hour')
    ON CONFLICT DO NOTHING RETURNING id INTO inv3;
    IF inv3 IS NOT NULL THEN
      INSERT INTO lis_invoice_items (invoice_id, test_id, item_name, price) VALUES
        (inv3, t_cbc, 'Complete Blood Count (CBC)', 300) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  PERFORM setval('lis_invoice_seq', 3);
END $$;

-- ── Payment History ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lis_payment_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID REFERENCES lis_invoices(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL,
  payment_mode TEXT,
  received_by  UUID REFERENCES auth.users,
  received_at  TIMESTAMPTZ DEFAULT NOW(),
  notes        TEXT
);

ALTER TABLE lis_payment_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON lis_payment_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
