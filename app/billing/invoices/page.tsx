"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Receipt } from "lucide-react";
import { format } from "date-fns";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_status: string;
  payment_mode: string | null;
  created_at: string;
  patient_name: string;
  patient_code: string;
};

const STATUS: Record<string, string> = {
  paid:    "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
};

export default function InvoicesPage() {
  const router = useRouter();
  const [rows, setRows]       = useState<InvoiceRow[]>([]);
  const [query, setQuery]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let qb = supabase
      .from("lis_invoices")
      .select("id, invoice_number, total_amount, payment_status, payment_mode, created_at, lis_patients(full_name, patient_code)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (dateFrom) qb = qb.gte("created_at", dateFrom);

    const { data } = await qb;
    let rows = (data || []).map((r: Record<string, unknown>) => ({
      id:             r.id as string,
      invoice_number: r.invoice_number as string,
      total_amount:   r.total_amount as number,
      payment_status: r.payment_status as string,
      payment_mode:   r.payment_mode as string | null,
      created_at:     r.created_at as string,
      patient_name:   (r.lis_patients as { full_name: string; patient_code: string } | null)?.full_name ?? "—",
      patient_code:   (r.lis_patients as { full_name: string; patient_code: string } | null)?.patient_code ?? "—",
    }));

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(r =>
        r.invoice_number.toLowerCase().includes(q) ||
        r.patient_name.toLowerCase().includes(q) ||
        r.patient_code.toLowerCase().includes(q)
      );
    }

    setRows(rows);
    setLoading(false);
  }, [query, dateFrom]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      load();
    });
  }, []); // eslint-disable-line

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const totalRevenue = rows.filter(r => r.payment_status === "paid").reduce((s, r) => s + r.total_amount, 0);
  const pending      = rows.filter(r => r.payment_status === "pending").length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Invoices" />
        <main className="flex-1 p-6">

          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Invoice History</h2>
              <p className="text-slate-500 text-sm">{rows.length} invoices · ₹{totalRevenue.toLocaleString("en-IN")} collected · {pending} pending</p>
            </div>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/billing"><Plus className="w-4 h-4 mr-1.5" /> New Invoice</a>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search invoice, patient name or ID..."
                className="pl-9 bg-white" />
            </div>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-auto bg-white" />
            {dateFrom && (
              <Button variant="outline" onClick={() => setDateFrom("")} className="text-slate-500">
                Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Invoice No.", "Patient", "Date", "Amount", "Mode", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-slate-400 text-sm">No invoices found</p>
                        <a href="/billing" className="text-blue-600 text-sm hover:underline mt-1 inline-block">Create first invoice →</a>
                      </td>
                    </tr>
                  ) : (
                    rows.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{r.invoice_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{r.patient_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{r.patient_code}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), "dd MMM yyyy")}<br />
                          <span className="text-slate-400">{format(new Date(r.created_at), "hh:mm a")}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">₹{r.total_amount.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-slate-600 capitalize">{r.payment_mode ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs border ${STATUS[r.payment_status] ?? STATUS.pending}`}>
                            {r.payment_status}
                          </Badge>
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
