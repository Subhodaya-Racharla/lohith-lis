"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Users, ClipboardList, IndianRupee, FlaskConical, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";

type Stats = {
  todayPatients: number;
  pendingInvoices: number;
  todayRevenue: number;
  totalTests: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]   = useState<Stats>({ todayPatients: 0, pendingInvoices: 0, todayRevenue: 0, totalTests: 0 });
  const [recent, setRecent] = useState<{ id: string; full_name: string; phone: string; patient_code: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      loadStats();
    });
  }, []); // eslint-disable-line

  async function loadStats() {
    const [
      { count: todayPat },
      { count: pending },
      { data: revData },
      { count: tests },
      { data: recentPat },
    ] = await Promise.all([
      supabase.from("lis_patients").select("*", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("lis_invoices").select("*", { count: "exact", head: true }).eq("payment_status", "pending"),
      supabase.from("lis_invoices").select("total_amount").gte("created_at", today).eq("payment_status", "paid"),
      supabase.from("lis_tests").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("lis_patients").select("id, full_name, phone, patient_code, created_at").order("created_at", { ascending: false }).limit(5),
    ]);
    const revenue = (revData || []).reduce((s: number, r: { total_amount: number }) => s + (r.total_amount || 0), 0);
    setStats({
      todayPatients: todayPat || 0,
      pendingInvoices: pending || 0,
      todayRevenue: revenue,
      totalTests: tests || 0,
    });
    setRecent(recentPat || []);
    setLoading(false);
  }

  const statCards = [
    { label: "Today's Patients", value: stats.todayPatients, icon: Users,          color: "bg-blue-500",   light: "bg-blue-50",  text: "text-blue-700" },
    { label: "Pending Reports",  value: stats.pendingInvoices, icon: ClipboardList, color: "bg-amber-500",  light: "bg-amber-50", text: "text-amber-700" },
    { label: "Today's Revenue",  value: `₹${stats.todayRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-green-500",  light: "bg-green-50", text: "text-green-700" },
    { label: "Active Tests",     value: stats.totalTests, icon: FlaskConical,       color: "bg-purple-500", light: "bg-purple-50", text: "text-purple-700" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Dashboard" />
        <main className="flex-1 p-6 space-y-6">

          {/* Welcome */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"} 👋</h2>
              <p className="text-slate-500 text-sm">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              Live data
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color, light, text }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <div className={`w-11 h-11 ${light} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
                  {loading ? (
                    <div className="h-6 w-12 bg-slate-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-slate-800">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Recent patients */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Recent Patients</h3>
                <a href="/patients" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              <div className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse" />
                      <div className="space-y-1 flex-1">
                        <div className="h-3 bg-slate-100 rounded w-32 animate-pulse" />
                        <div className="h-2.5 bg-slate-100 rounded w-20 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : recent.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No patients yet</p>
                ) : (
                  recent.map(p => (
                    <a key={p.id} href={`/patients/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-blue-700 text-xs font-bold">{p.full_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                        <p className="text-xs text-slate-400">{p.patient_code} · {p.phone}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {format(new Date(p.created_at), "dd MMM")}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>

            {/* Quick actions panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: "/patients/new", label: "Register Patient", icon: Users, color: "bg-blue-600 hover:bg-blue-700" },
                  { href: "/billing",      label: "New Invoice",       icon: IndianRupee, color: "bg-green-600 hover:bg-green-700" },
                  { href: "/patients",     label: "Patient List",      icon: ClipboardList, color: "bg-slate-700 hover:bg-slate-800" },
                  { href: "/billing/invoices", label: "Invoices",      icon: TrendingUp, color: "bg-purple-600 hover:bg-purple-700" },
                ].map(({ href, label, icon: Icon, color }) => (
                  <a key={href} href={href}
                    className={`${color} text-white rounded-xl p-4 flex flex-col gap-2 transition-colors`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-semibold">{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
