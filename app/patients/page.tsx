"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Search, Plus, ChevronRight, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";

type PatientRow = {
  id: string; patient_code: string; full_name: string; phone: string;
  age: number | null; gender: string | null; city: string | null;
  created_at: string; doctor_name: string | null;
};

const FILTERS = [
  { label: "All",       value: "all"   },
  { label: "Today",     value: "today" },
  { label: "This Week", value: "week"  },
  { label: "Month",     value: "month" },
];

function getFrom(f: string): string | null {
  const now = new Date();
  if (f === "today") return startOfDay(now).toISOString();
  if (f === "week")  return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (f === "month") return startOfMonth(now).toISOString();
  return null;
}

export default function PatientsPage() {
  const router  = useRouter();
  const [rows, setRows]     = useState<PatientRow[]>([]);
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string, f: string) => {
    setLoading(true);
    let qb = supabase
      .from("lis_patients")
      .select("id, patient_code, full_name, phone, age, gender, city, created_at, lis_doctors(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    const from = getFrom(f);
    if (from) qb = qb.gte("created_at", from);
    if (q.trim()) qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`);

    const { data } = await qb;
    setRows((data || []).map((r: Record<string, unknown>) => ({
      ...(r as Omit<PatientRow, "doctor_name">),
      doctor_name: (r.lis_doctors as { name: string } | null)?.name ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      load("", "all");
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => load(query, filter), 300);
    return () => clearTimeout(t);
  }, [query, filter, load]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Patients" />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Patient Registry</h2>
              <p className="text-slate-500 text-xs md:text-sm">{rows.length} patients found</p>
            </div>
            <a href="/patients/new"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Register Patient</span>
              <span className="sm:hidden">New</span>
            </a>
          </div>

          {/* Search + filters */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, phone, or Patient ID..."
                className="pl-9 bg-white" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {FILTERS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    filter === f.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {!loading && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <User className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-slate-700 font-semibold">No patients found</p>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  {query ? `No results for "${query}"` : "Register your first patient to get started."}
                </p>
                <a href="/patients/new"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Register Patient
                </a>
              </div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <div className="md:hidden divide-y divide-slate-100">
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 bg-slate-100 rounded w-36 animate-pulse" />
                          <div className="h-2.5 bg-slate-100 rounded w-24 animate-pulse" />
                        </div>
                      </div>
                    ))
                  ) : (
                    rows.map(p => (
                      <div key={p.id}
                        className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                        onClick={() => router.push(`/billing?patient=${p.id}`)}>
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-blue-700 font-bold text-sm">{p.full_name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-slate-800 truncate">{p.full_name}</p>
                            {p.gender && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                {p.gender === "M" ? "M" : p.gender === "F" ? "F" : "O"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {p.patient_code} · {p.phone}
                          </p>
                          <p className="text-xs text-slate-400">
                            {p.age ? `${p.age}y · ` : ""}{p.doctor_name ?? "Walk-in"} · {format(new Date(p.created_at), "dd MMM")}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </div>
                    ))
                  )}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Patient ID", "Full Name", "Age / Gender", "Mobile", "Referring Doctor", "Registered On", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        [...Array(6)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(7)].map((__, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        rows.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.patient_code}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{p.full_name}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {p.age ? `${p.age}y` : "—"}{" "}
                              {p.gender && (
                                <Badge variant="outline" className="text-xs ml-1">
                                  {p.gender === "M" ? "M" : p.gender === "F" ? "F" : "O"}
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{p.doctor_name ?? <span className="text-slate-300">Walk-in</span>}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{format(new Date(p.created_at), "dd MMM yyyy")}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => router.push(`/billing?patient=${p.id}`)}
                                  className="text-xs text-green-600 hover:underline font-medium">Invoice</button>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
