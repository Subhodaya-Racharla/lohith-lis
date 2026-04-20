import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type LisProfile = {
  id: string;
  full_name: string | null;
  role: "admin" | "receptionist" | "pathologist";
  created_at: string;
};

export type Doctor = {
  id: string;
  name: string;
  clinic_name: string | null;
  phone: string | null;
  commission_percent: number;
  is_active: boolean;
  created_at: string;
};

export type Patient = {
  id: string;
  patient_code: string;
  full_name: string;
  age: number | null;
  gender: "M" | "F" | "Other" | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  referring_doctor_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

export type LisTest = {
  id: string;
  test_code: string;
  test_name: string;
  price: number;
  department: string | null;
  is_active: boolean;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  patient_id: string;
  referring_doctor_id: string | null;
  subtotal: number;
  discount_percent: number;
  gst_applicable: boolean;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_mode: string | null;
  payment_status: string;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  test_id: string | null;
  item_name: string;
  price: number;
  quantity: number;
};
