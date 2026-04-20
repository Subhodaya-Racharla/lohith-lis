"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Search, Plus, ChevronRight, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type PatientRow = {
  id: string;
  patient_code: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  created_at: string;
  doctor_name: string | null;
};

export default function PatientsPage() {
  const router = useRouter();
  const [rows, setRows]       = useState<PatientRow[]>([]);
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    let qb = supabase
      .from("lis_patients")
      .select("id, patient_code, full_name, phone, age, gender, city, created_at, lis_doctors(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (q.trim()) {
      qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`);
    }

    const { data } = await qb;
    setRows(
      (data || []).map((r: Record<string, unknown>) => ({
        ...(r as Omit<PatientRow, "doctor_name">),
        doctor_name: (r.lis_doctors as { name: string } | null)?.name ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      load("");
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Patients" />
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Patient Registry</h2>
              <p className="text-slate-500 text-sm">Search, register, and manage patients</p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/patients/new">
                <Plus className="w-4 h-4 mr-1.5" /> Register Patient
              </a>
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, phone, or Patient ID..."
              className="pl-9 bg-white"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Patient ID", "Name", "Phone", "Age / Gender", "Referring Doctor", "Registered", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-slate-400 text-sm">
                          {query ? `No patients found for "${query}"` : "No patients registered yet"}
                        </p>
                        <a href="/patients/new" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                          Register first patient →
                        </a>
                      </td>
                    </tr>
                  ) : (
                    rows.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/patients/${p.id}`)}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {p.patient_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{p.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.age ? `${p.age}y` : "—"}{" "}
                          {p.gender && (
                            <Badge variant="outline" className="text-xs">
                              {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : "Other"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.doctor_name ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{format(new Date(p.created_at), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
