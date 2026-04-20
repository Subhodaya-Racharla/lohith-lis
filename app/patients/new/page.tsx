"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  full_name:           z.string().min(2, "Name is required"),
  age:                 z.coerce.number().min(0).max(150).optional(),
  gender:              z.enum(["M", "F", "Other"]).optional(),
  phone:               z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit Indian mobile"),
  email:               z.string().email("Invalid email").optional().or(z.literal("")),
  address:             z.string().optional(),
  city:                z.string().optional(),
  referring_doctor_id: z.string().optional(),
  notes:               z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type Doctor = { id: string; name: string; clinic_name: string | null };

export default function NewPatientPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving]   = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
    });
    supabase.from("lis_doctors").select("id, name, clinic_name").eq("is_active", true).order("name")
      .then(({ data }) => setDoctors(data || []));
  }, []); // eslint-disable-line

  async function onSubmit(data: FormData) {
    setSaving(true);
    // Generate patient code
    const { data: seqData } = await supabase.rpc("next_patient_code");
    const patient_code = seqData ?? `LPL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const { data: inserted, error } = await supabase.from("lis_patients").insert({
      patient_code,
      full_name:           data.full_name.trim(),
      age:                 data.age || null,
      gender:              data.gender || null,
      phone:               data.phone.trim(),
      email:               data.email || null,
      address:             data.address || null,
      city:                data.city || null,
      referring_doctor_id: data.referring_doctor_id || null,
      notes:               data.notes || null,
    }).select("id").single();

    if (error) {
      toast.error("Failed to register patient: " + error.message);
      setSaving(false);
      return;
    }
    toast.success(`Patient registered — ${patient_code}`);
    router.push(`/patients/${inserted.id}`);
  }

  const field = (id: keyof FormData, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-slate-700">{label}</Label>
      <Input id={id} {...register(id)} {...props}
        className={errors[id] ? "border-red-400 focus-visible:ring-red-400" : ""} />
      {errors[id] && <p className="text-red-500 text-xs">{errors[id]?.message as string}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Register Patient" />
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">

            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">New Patient Registration</h2>
                <p className="text-slate-500 text-sm">Patient ID will be auto-generated</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Personal info */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Personal Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field("full_name", "Full Name *", { placeholder: "e.g. Ramesh Kumar" })}
                  {field("phone", "Mobile Number *", { placeholder: "10-digit mobile", maxLength: 10, inputMode: "numeric" })}
                  {field("age", "Age", { placeholder: "e.g. 35", type: "number", min: "0", max: "150" })}
                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-slate-700">Gender</Label>
                    <select id="gender" {...register("gender")}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-slate-900 focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Select gender</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {field("email", "Email", { placeholder: "optional", type: "email" })}
                  {field("city", "City", { placeholder: "e.g. Medak" })}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-slate-700">Address</Label>
                  <textarea id="address" {...register("address")} rows={2}
                    placeholder="Full address"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              {/* Referral */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Referral & Notes</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="referring_doctor_id" className="text-slate-700">Referring Doctor</Label>
                  <select id="referring_doctor_id" {...register("referring_doctor_id")}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-slate-900 focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— No referral —</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.clinic_name ? ` — ${d.clinic_name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-slate-700">Notes</Label>
                  <textarea id="notes" {...register("notes")} rows={2}
                    placeholder="Any relevant medical notes..."
                    className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 py-3">
                <UserPlus className="w-4 h-4 mr-2" />
                {saving ? "Registering..." : "Register Patient"}
              </Button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
