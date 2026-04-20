-- ================================================================
-- Lohith Path Labs — LIS Schema
-- Run this entire script in Supabase SQL Editor
-- ================================================================

-- Doctors
CREATE TABLE IF NOT EXISTS lis_doctors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  clinic_name      TEXT,
  phone            TEXT,
  commission_percent NUMERIC DEFAULT 10,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS lis_patients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_code         TEXT UNIQUE NOT NULL,
  full_name            TEXT NOT NULL,
  age                  INT,
  gender               TEXT CHECK (gender IN ('M', 'F', 'Other')),
  phone                TEXT NOT NULL,
  email                TEXT,
  address              TEXT,
  city                 TEXT,
  referring_doctor_id  UUID REFERENCES lis_doctors(id),
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  created_by           UUID REFERENCES auth.users
);

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
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq INT;
BEGIN
  seq := nextval('lis_patient_seq');
  RETURN 'LPL-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE seq INT;
BEGIN
  seq := nextval('lis_invoice_seq');
  RETURN 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq::TEXT, 5, '0');
END;
$$;

-- ── RLS — allow authenticated users full access ──────────────────────────────

ALTER TABLE lis_doctors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lis_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON lis_doctors       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON lis_patients      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON lis_tests         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON lis_invoices      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON lis_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed: Doctors ────────────────────────────────────────────────────────────

INSERT INTO lis_doctors (name, clinic_name, phone, commission_percent) VALUES
  ('Dr. Ramesh Kumar',  'Apollo Hospital',  '9876543210', 10),
  ('Dr. Priya Sharma',  'Care Hospital',    '9876543211', 10),
  ('Dr. Suresh Reddy',  'Own Clinic',       '9876543212', 8),
  ('Dr. Anjali Mehta',  'KIMS Hospital',    '9876543213', 12)
ON CONFLICT DO NOTHING;

-- ── Seed: Tests ─────────────────────────────────────────────────────────────

INSERT INTO lis_tests (test_code, test_name, price, department) VALUES
  ('CBC001',  'Complete Blood Count (CBC)',       300,  'Haematology'),
  ('BSF001',  'Blood Sugar Fasting',              100,  'Biochemistry'),
  ('HBA001',  'HbA1c',                            450,  'Biochemistry'),
  ('LIP001',  'Lipid Profile',                    600,  'Biochemistry'),
  ('TSH001',  'Thyroid TSH',                      250,  'Thyroid'),
  ('T3001',   'T3 (Triiodothyronine)',            300,  'Thyroid'),
  ('T4001',   'T4 (Thyroxine)',                   300,  'Thyroid'),
  ('LFT001',  'Liver Function Test (LFT)',        700,  'Biochemistry'),
  ('KFT001',  'Kidney Function Test (KFT)',       600,  'Biochemistry'),
  ('URN001',  'Urine Routine & Microscopy',       150,  'Urine'),
  ('WID001',  'Widal Test',                       250,  'Serology'),
  ('DEN001',  'Dengue NS1 Antigen',               800,  'Serology'),
  ('MAL001',  'Malaria Parasite Test',            200,  'Serology'),
  ('TYP001',  'Typhoid IgM',                      500,  'Serology'),
  ('VTD001',  'Vitamin D (25-OH)',               1200,  'Endocrinology'),
  ('VTB001',  'Vitamin B12',                      900,  'Endocrinology'),
  ('IRN001',  'Iron Studies',                    1000,  'Biochemistry'),
  ('ECG001',  'ECG (Electrocardiogram)',          300,  'Cardiology'),
  ('ECH001',  'ECHO (Echocardiography)',         1500,  'Cardiology'),
  ('XRC001',  'X-Ray Chest (PA View)',            400,  'Radiology')
ON CONFLICT DO NOTHING;

-- ── Create demo admin user (run separately in Auth > Users if email signup disabled) ──
-- Email: admin@lohithpathlabs.in
-- Password: Admin@2026
-- After creating user in Auth dashboard, the user can log in immediately.
