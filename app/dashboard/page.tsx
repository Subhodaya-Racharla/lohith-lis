"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Users, IndianRupee, ClipboardList, UserCheck, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth } from "date-fns";

type Stats = {
  todayPatients: number;
  todayRevenue: number;
  pendingInvoices: number;
  pendingAmount: number;
  monthPatients: number;
};
type RecentPatient = { id: string; full_name: string; phone: string; patient_code: string; age: number | null; gender: string | null; created_at: string };
type RecentInvoice = { id: string; invoice_number: string; total_amount: number; payment_status: string; created_at: string; patient_name: string };

const STATUS_CLS: Record<string, string> = {
  paid:    "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]     = useState<Stats>({ todayPatients: 0, todayRevenue: 0, pendingInvoices: 0, pendingAmount: 0, monthPatients: 0 });
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      load();
    });
  }, []); // eslint-disable-line

  async function load() {
    const [
      { count: todayPat },
      { data: pendingData },
      { data: revData },
      { count: monthPat },
      { data: recentPat },
      { data: recentInv },
    ] = await Promise.all([
      supabase.from("lis_patients").select("*", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("lis_invoices").select("total_amount, amount_paid").in("payment_status", ["pending", "partial"]),
      supabase.from("lis_invoices").select("total_amount").gte("created_at", today).eq("payment_status", "paid"),
      supabase.from("lis_patients").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("lis_patients").select("id, full_name, phone, patient_code, age, gender, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("lis_invoices").select("id, invoice_number, total_amount, payment_status, created_at, lis_patients(full_name)").order("created_at", { ascending: false }).limit(5),
    ]);

    const revenue    = (revData || []).reduce((s: number, r: { total_amount: number }) => s + (r.total_amount || 0), 0);
    const pendingAmt = (pendingData || []).reduce((s: number, r: { total_amount: number; amount_paid: number }) => s + ((r.total_amount || 0) - (r.amount_paid || 0)), 0);
    setStats({ todayPatients: todayPat || 0, todayRevenue: revenue, pendingInvoices: (pendingData || []).length, pendingAmount: pendingAmt, monthPatients: monthPat || 0 });
    setPatients(recentPat || []);
    setInvoices((recentInv || []).map((r: Record<string, unknown>) => ({
      id:             r.id as string,
      invoice_number: r.invoice_number as string,
      total_amount:   r.total_amount as number,
      payment_status: r.payment_status as string,
      created_at:     r.created_at as string,
      patient_name:   (r.lis_patients as { full_name: string } | null)?.full_name ?? "—",
    })));
    setLoading(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Dashboard" />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 space-y-5">

          {/* Greeting + quick actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">{greeting} 👋</h2>
              <p className="text-slate-500 text-sm">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a href="/patients/new"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Patient
              </a>
              <a href="/billing"
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Invoice
              </a>
              <a href="/patients"
                className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3 py-2 rounded-lg transition-colors">
                <Search className="w-4 h-4" /> Search
              </a>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

            {/* Today's Patients */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              {loading ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mb-1" /> : (
                <p className="text-2xl font-bold text-slate-800">{stats.todayPatients}</p>
              )}
              <p className="text-xs text-slate-500 font-medium mt-0.5">Today&apos;s Patients</p>
            </div>

            {/* Today's Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                <IndianRupee className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              </div>
              {loading ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mb-1" /> : (
                <p className="text-xl md:text-2xl font-bold text-slate-800">₹{stats.todayRevenue.toLocaleString("en-IN")}</p>
              )}
              <p className="text-xs text-slate-500 font-medium mt-0.5">Today&apos;s Revenue</p>
            </div>

            {/* Pending Invoices — clickable */}
            <Link
              href="/billing/invoices?status=pending"
              className="bg-white rounded-xl border border-amber-200 p-4 md:p-5 hover:bg-amber-50 hover:border-amber-300 transition-colors group block"
            >
              <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-amber-100 transition-colors">
                <ClipboardList className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
              </div>
              {loading ? (
                <>
                  <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mb-1" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mt-1" />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-800">{stats.pendingInvoices}</p>
                  {stats.pendingInvoices > 0 && (
                    <p className="text-xs text-amber-600 font-semibold mt-0.5">
                      ₹{stats.pendingAmount.toLocaleString("en-IN")} due
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-slate-500 font-medium mt-0.5">Pending Invoices</p>
            </Link>

            {/* Patients This Month */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
                <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              </div>
              {loading ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mb-1" /> : (
                <p className="text-2xl font-bold text-slate-800">{stats.monthPatients}</p>
              )}
              <p className="text-xs text-slate-500 font-medium mt-0.5">This Month</p>
            </div>
          </div>

          {/* Recent lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">

            {/* Recent patients */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Recent Patients</h3>
                <a href="/patients" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              <div className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-32 animate-pulse" />
                        <div className="h-2.5 bg-slate-100 rounded w-20 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : patients.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm text-slate-400">No patients yet</p>
                    <a href="/patients/new" className="text-blue-600 text-xs hover:underline mt-1 inline-block">Register first patient →</a>
                  </div>
                ) : (
                  patients.map(p => (
                    <a key={p.id} href={`/billing?patient=${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-blue-700 text-xs font-bold">{p.full_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                        <p className="text-xs text-slate-400">{p.patient_code} · {p.age ? `${p.age}y` : ""}{p.gender ? ` ${p.gender}` : ""}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{format(new Date(p.created_at), "dd MMM")}</span>
                    </a>
                  ))
                )}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Recent Invoices</h3>
                <a href="/billing/invoices" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              <div className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-28 animate-pulse" />
                        <div className="h-2.5 bg-slate-100 rounded w-20 animate-pulse" />
                      </div>
                      <div className="h-5 w-12 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ))
                ) : invoices.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm text-slate-400">No invoices yet</p>
                    <a href="/billing" className="text-blue-600 text-xs hover:underline mt-1 inline-block">Create first invoice →</a>
                  </div>
                ) : (
                  invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold font-mono text-blue-600">{inv.invoice_number}</p>
                        <p className="text-xs text-slate-400 truncate">{inv.patient_name} · {format(new Date(inv.created_at), "dd MMM, hh:mm a")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="font-semibold text-slate-800 text-sm">₹{inv.total_amount.toLocaleString("en-IN")}</span>
                        <Badge className={`text-[10px] border ${STATUS_CLS[inv.payment_status] ?? STATUS_CLS.pending}`}>
                          {inv.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
