"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, User, Receipt, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Patient = {
  id: string; patient_code: string; full_name: string;
  age: number | null; gender: string | null; phone: string;
  email: string | null; address: string | null; city: string | null;
  notes: string | null; created_at: string;
  lis_doctors: { name: string; clinic_name: string | null } | null;
};

type InvoiceRow = {
  id: string; invoice_number: string; total_amount: number;
  payment_status: string; payment_mode: string | null; created_at: string;
};

const STATUS: Record<string, { label: string; className: string }> = {
  paid:    { label: "Paid",    className: "bg-green-100 text-green-700 border-green-200" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  partial: { label: "Partial", className: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function PatientDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient]   = useState<Patient | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      loadData();
    });
  }, []); // eslint-disable-line

  async function loadData() {
    const [{ data: pat }, { data: inv }] = await Promise.all([
      supabase.from("lis_patients").select("*, lis_doctors(name, clinic_name)").eq("id", id).single(),
      supabase.from("lis_invoices").select("id, invoice_number, total_amount, payment_status, payment_mode, created_at")
        .eq("patient_id", id).order("created_at", { ascending: false }),
    ]);
    if (!pat) { toast.error("Patient not found"); router.push("/patients"); return; }
    setPatient(pat as Patient);
    setInvoices(inv || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-slate-400 text-sm">Loading patient...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={patient.full_name} />
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push("/patients")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-800">{patient.full_name}</h2>
                  <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                    {patient.patient_code}
                  </span>
                  {patient.gender && (
                    <Badge variant="outline">
                      {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"}
                    </Badge>
                  )}
                </div>
                <p className="text-slate-500 text-sm">
                  Registered {format(new Date(patient.created_at), "dd MMMM yyyy")}
                  {patient.age ? ` · ${patient.age} years old` : ""}
                </p>
              </div>
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <a href={`/billing?patient=${patient.id}`}>
                  <Plus className="w-4 h-4 mr-1.5" /> New Invoice
                </a>
              </Button>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-700 text-sm">Contact Information</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a href={`tel:+91${patient.phone}`} className="hover:text-blue-600">+91 {patient.phone}</a>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {(patient.address || patient.city) && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{[patient.address, patient.city].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h3 className="font-semibold text-slate-700 text-sm">Referral & Notes</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-slate-700">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{patient.lis_doctors?.name ?? "No referral"}</p>
                      {patient.lis_doctors?.clinic_name && (
                        <p className="text-slate-400 text-xs">{patient.lis_doctors.clinic_name}</p>
                      )}
                    </div>
                  </div>
                  {patient.notes && (
                    <p className="text-slate-500 italic text-xs bg-slate-50 px-3 py-2 rounded-lg">
                      {patient.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice history */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-700 text-sm">Visit / Invoice History</h3>
                  <Badge variant="outline" className="text-xs">{invoices.length}</Badge>
                </div>
              </div>
              {invoices.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-slate-400 text-sm">No invoices yet</p>
                  <a href={`/billing?patient=${patient.id}`} className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                    Create first invoice →
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {invoices.map(inv => {
                    const s = STATUS[inv.payment_status] ?? STATUS.pending;
                    return (
                      <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-800">{inv.invoice_number}</p>
                          <p className="text-xs text-slate-400">{format(new Date(inv.created_at), "dd MMM yyyy, hh:mm a")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800">₹{inv.total_amount.toLocaleString("en-IN")}</span>
                          <Badge className={`text-xs border ${s.className}`}>{s.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
