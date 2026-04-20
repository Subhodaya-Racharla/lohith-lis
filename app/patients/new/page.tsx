"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";

type Doctor = { id: string; name: string; clinic_name: string | null };

const TITLES  = ["Mr.", "Mrs.", "Ms.", "Dr.", "Master", "Baby"];
const GENDERS = [{ v: "M", l: "Male" }, { v: "F", l: "Female" }, { v: "Other", l: "Other" }];
const AGE_UNITS = ["Years", "Months", "Days"];
const ID_PROOFS = ["None", "Aadhaar", "PAN", "Passport", "Voter ID", "Driving Licence"];

type Form = {
  title: string; full_name: string; dob: string; age: string; age_unit: string;
  gender: string; phone: string; alt_phone: string; email: string;
  address: string; city: string; pincode: string;
  referring_doctor_id: string; notes: string;
  id_proof_type: string; id_proof_number: string;
};

const empty: Form = {
  title: "Mr.", full_name: "", dob: "", age: "", age_unit: "Years",
  gender: "", phone: "", alt_phone: "", email: "",
  address: "", city: "", pincode: "",
  referring_doctor_id: "", notes: "",
  id_proof_type: "None", id_proof_number: "",
};

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm]     = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
    });
    supabase.from("lis_doctors").select("id, name, clinic_name").eq("is_active", true).order("name")
      .then(({ data }) => setDoctors(data || []));
  }, []); // eslint-disable-line

  function set(key: keyof Form, val: string) {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  }

  // Auto-calculate age from DOB
  function handleDobChange(dob: string) {
    set("dob", dob);
    if (dob) {
      const yrs = differenceInYears(new Date(), new Date(dob));
      if (yrs >= 0) { set("age", String(yrs)); set("age_unit", "Years"); }
    }
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.full_name.trim())                        e.full_name = "Full name is required";
    if (!/^[6-9]\d{9}$/.test(form.phone))             e.phone     = "Enter valid 10-digit Indian mobile";
    if (form.alt_phone && !/^\d{10}$/.test(form.alt_phone)) e.alt_phone = "Enter valid 10-digit number";
    if (form.pincode && !/^\d{6}$/.test(form.pincode))  e.pincode   = "Enter valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(redirect: "detail" | "invoice") {
    if (!validate()) return;
    setSaving(true);

    const { data: seqData } = await supabase.rpc("next_patient_code");
    const patient_code = seqData ?? `LPL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const { data: inserted, error } = await supabase.from("lis_patients").insert({
      patient_code,
      title:               form.title || null,
      full_name:           `${form.title} ${form.full_name}`.trim(),
      dob:                 form.dob || null,
      age:                 form.age ? parseInt(form.age) : null,
      age_unit:            form.age_unit,
      gender:              form.gender || null,
      phone:               form.phone,
      alt_phone:           form.alt_phone || null,
      email:               form.email || null,
      address:             form.address || null,
      city:                form.city || null,
      pincode:             form.pincode || null,
      referring_doctor_id: form.referring_doctor_id || null,
      notes:               form.notes || null,
      id_proof_type:       form.id_proof_type !== "None" ? form.id_proof_type : null,
      id_proof_number:     form.id_proof_number || null,
    }).select("id").single();

    if (error) {
      toast.error("Failed to register: " + error.message);
      setSaving(false);
      return;
    }

    toast.success(`Patient registered — ${patient_code}`);
    if (redirect === "invoice") {
      router.push(`/billing?patient=${inserted.id}`);
    } else {
      router.push(`/patients/${inserted.id}`);
    }
  }

  const sel = (id: keyof Form, label: string, opts: string[], req = false) => (
    <div className="space-y-1.5">
      <Label className="text-slate-700 text-sm">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</Label>
      <select value={form[id]} onChange={e => set(id, e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors[id] && <p className="text-red-500 text-xs">{errors[id]}</p>}
    </div>
  );

  const inp = (id: keyof Form, label: string, placeholder: string, opts: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, req = false) => (
    <div className="space-y-1.5">
      <Label className="text-slate-700 text-sm">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</Label>
      <Input value={form[id]} onChange={e => set(id, e.target.value)} placeholder={placeholder}
        className={errors[id] ? "border-red-400 focus-visible:ring-red-300" : ""}
        {...opts} />
      {errors[id] && <p className="text-red-500 text-xs">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Register Patient" />
        <main className="flex-1 pb-24 p-6">
          <div className="max-w-2xl mx-auto">

            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => router.back()}
                className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">New Patient Registration</h2>
                <p className="text-slate-500 text-sm">Patient ID auto-generated on save</p>
              </div>
            </div>

            <div className="space-y-5">

              {/* Personal info */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal Information</h3>

                {/* Title + Name */}
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  {sel("title", "Title", TITLES)}
                  {inp("full_name", "Full Name", "e.g. Ramesh Kumar", {}, true)}
                </div>

                {/* DOB + Age */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 text-sm">Date of Birth</Label>
                    <Input type="date" value={form.dob}
                      onChange={e => handleDobChange(e.target.value)}
                      max={new Date().toISOString().split("T")[0]} />
                    <p className="text-xs text-slate-400">Auto-calculates age</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 text-sm">Age</Label>
                    <div className="flex gap-2">
                      <Input value={form.age} onChange={e => set("age", e.target.value)}
                        placeholder="e.g. 35" type="number" min="0" max="150" inputMode="numeric" />
                      <select value={form.age_unit} onChange={e => set("age_unit", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0">
                        {AGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Gender</Label>
                  <div className="flex gap-2">
                    {GENDERS.map(g => (
                      <button key={g.v} type="button" onClick={() => set("gender", g.v)}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${form.gender === g.v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        {g.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contact Information</h3>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Mobile Number<span className="text-red-400 ml-0.5">*</span></Label>
                  <div className="flex">
                    <span className="flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-slate-600 text-sm font-semibold select-none">
                      🇮🇳 +91
                    </span>
                    <Input value={form.phone} onChange={e => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="10-digit mobile" inputMode="numeric" maxLength={10}
                      className={`rounded-l-none ${errors.phone ? "border-red-400 focus-visible:ring-red-300" : ""}`} />
                  </div>
                  {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
                </div>

                {inp("alt_phone", "Alternate Mobile", "Optional — family contact", { inputMode: "numeric", maxLength: 10 })}
                {inp("email", "Email", "optional@example.com", { type: "email" })}
              </div>

              {/* Address */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Address</h3>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Full Address</Label>
                  <textarea value={form.address} onChange={e => set("address", e.target.value)}
                    placeholder="House no., street, area, landmark..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {inp("city", "City", "e.g. Medak")}
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 text-sm">Pincode</Label>
                    <Input value={form.pincode} onChange={e => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit pincode" inputMode="numeric" maxLength={6}
                      className={errors.pincode ? "border-red-400" : ""} />
                    {errors.pincode && <p className="text-red-500 text-xs">{errors.pincode}</p>}
                  </div>
                </div>
              </div>

              {/* Referral + ID */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Referral & Identification</h3>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Referring Doctor</Label>
                  <select value={form.referring_doctor_id} onChange={e => set("referring_doctor_id", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Walk-in / Self</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}{d.clinic_name ? ` — ${d.clinic_name}` : ""}</option>
                    ))}
                  </select>
                </div>

                {/* ID Proof */}
                <div className="grid grid-cols-2 gap-3">
                  {sel("id_proof_type", "ID Proof Type", ID_PROOFS)}
                  {form.id_proof_type !== "None" && (
                    inp("id_proof_number", "ID Number", `Enter ${form.id_proof_type} number`)
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Notes</Label>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                    placeholder="Any relevant medical notes or history..."
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Sticky bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3 z-30">
          <button onClick={() => router.push("/patients")}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors">
            ← Cancel
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => save("invoice")} disabled={saving}
              className="flex items-center gap-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Receipt className="w-4 h-4" />
              Register & Create Invoice
            </button>
            <button onClick={() => save("detail")} disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              {saving ? "Registering..." : "Register Patient"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
