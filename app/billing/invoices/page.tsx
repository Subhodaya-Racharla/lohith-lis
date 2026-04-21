"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Receipt, X, MessageCircle, CreditCard, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  payment_mode: string | null;
  created_at: string;
  patient_name: string;
  patient_code: string;
  patient_phone: string;
};

const STATUS: Record<string, string> = {
  paid:    "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  partial: "bg-orange-100 text-orange-700 border-orange-200",
};

const FILTER_CHIPS = [
  { label: "All",     value: "" },
  { label: "Paid",    value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Partial", value: "partial" },
];

// ── Payment modal (bottom sheet on mobile) ────────────────────────────────────

function RecordPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const remaining = invoice.total_amount - invoice.amount_paid;
  const [amount, setAmount]         = useState(String(remaining));
  const [mode, setMode]             = useState("cash");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > remaining + 0.01) {
      toast.error(`Amount cannot exceed remaining ₹${remaining.toLocaleString("en-IN")}`);
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { error: phErr } = await supabase.from("lis_payment_history").insert({
      invoice_id:   invoice.id,
      amount:       amt,
      payment_mode: mode,
      received_by:  session?.user?.id ?? null,
      received_at:  new Date(receivedAt).toISOString(),
      notes:        notes || null,
    });

    if (phErr) { toast.error("Failed: " + phErr.message); setSaving(false); return; }

    const newPaid   = invoice.amount_paid + amt;
    const newStatus = newPaid >= invoice.total_amount - 0.01 ? "paid" : "partial";

    await supabase.from("lis_invoices").update({
      amount_paid:    newPaid,
      payment_status: newStatus,
      payment_mode:   mode,
    }).eq("id", invoice.id);

    toast.success(`₹${amt.toLocaleString("en-IN")} recorded — ${newStatus === "paid" ? "fully paid ✓" : "partially paid"}`);
    setSaving(false);
    onSuccess();
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Sheet — slides up on mobile, centered on desktop */}
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Record Payment</h3>
            <p className="text-xs text-slate-500 font-mono">{invoice.invoice_number} · {invoice.patient_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance summary */}
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex justify-between text-sm">
          <div>
            <p className="text-xs text-amber-600 font-medium">Total</p>
            <p className="font-bold text-slate-800">₹{invoice.total_amount.toLocaleString("en-IN")}</p>
          </div>
          {invoice.amount_paid > 0 && (
            <div>
              <p className="text-xs text-amber-600 font-medium">Paid</p>
              <p className="font-bold text-green-700">₹{invoice.amount_paid.toLocaleString("en-IN")}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-amber-600 font-medium">Remaining</p>
            <p className="font-bold text-red-600">₹{remaining.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">Amount Received <span className="text-red-400">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">₹</span>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="pl-7 text-base" min="1" max={remaining} step="0.01" inputMode="decimal" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">Payment Mode</Label>
            <div className="flex gap-2">
              {["cash", "upi", "card"].map(m => (
                <button key={m} onClick={() => setMode(m)} type="button"
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${
                    mode === m ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">Date of Payment</Label>
            <Input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
              max={new Date().toISOString().split("T")[0]} className="text-base" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-slate-700">Notes <span className="text-slate-400 text-xs">(optional)</span></Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Part payment..." className="text-base" />
          </div>

          <div className="flex gap-3 pt-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <Button variant="outline" className="flex-1 h-12" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 h-12 bg-blue-600 hover:bg-blue-700" onClick={submit} disabled={saving}>
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function InvoicesInner() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";

  const [rows, setRows]                   = useState<InvoiceRow[]>([]);
  const [query, setQuery]                 = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [statusFilter, setStatusFilter]   = useState(initialStatus);
  const [loading, setLoading]             = useState(true);
  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let qb = supabase
      .from("lis_invoices")
      .select("id, invoice_number, total_amount, amount_paid, payment_status, payment_mode, created_at, lis_patients(full_name, patient_code, phone)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (dateFrom)     qb = qb.gte("created_at", dateFrom);
    if (statusFilter) qb = qb.eq("payment_status", statusFilter);

    const { data } = await qb;
    type RawPat = { full_name: string; patient_code: string; phone: string };
    let mapped: InvoiceRow[] = (data || []).map((r: Record<string, unknown>) => ({
      id:             r.id as string,
      invoice_number: r.invoice_number as string,
      total_amount:   r.total_amount as number,
      amount_paid:    (r.amount_paid as number) || 0,
      payment_status: r.payment_status as string,
      payment_mode:   r.payment_mode as string | null,
      created_at:     r.created_at as string,
      patient_name:   (r.lis_patients as RawPat | null)?.full_name ?? "—",
      patient_code:   (r.lis_patients as RawPat | null)?.patient_code ?? "—",
      patient_phone:  (r.lis_patients as RawPat | null)?.phone ?? "",
    }));

    if (query.trim()) {
      const q = query.toLowerCase();
      mapped = mapped.filter(r =>
        r.invoice_number.toLowerCase().includes(q) ||
        r.patient_name.toLowerCase().includes(q) ||
        r.patient_code.toLowerCase().includes(q)
      );
    }
    setRows(mapped);
    setLoading(false);
  }, [query, dateFrom, statusFilter]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      load();
    });
  }, []); // eslint-disable-line

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  function sendReminder(r: InvoiceRow) {
    const remaining = r.total_amount - r.amount_paid;
    const msg = [
      `Dear ${r.patient_name},`,
      ``,
      `This is a friendly reminder from *Lohith Path Labs* that ₹${remaining.toLocaleString("en-IN")} is pending for invoice *#${r.invoice_number}*.`,
      ``,
      `Please clear the balance at your earliest convenience.`,
      ``,
      `📞 +91 91821 47180`,
      `🌐 lohithpathlabs.in`,
    ].join("\n");
    window.open(`https://wa.me/91${r.patient_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const totalRevenue = rows.filter(r => r.payment_status === "paid").reduce((s, r) => s + r.total_amount, 0);
  const pendingCount = rows.filter(r => r.payment_status !== "paid").length;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Invoices" />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Invoice History</h2>
              <p className="text-slate-500 text-xs md:text-sm">
                {rows.length} invoices · ₹{totalRevenue.toLocaleString("en-IN")} · {pendingCount} pending
              </p>
            </div>
            <LinkButton href="/billing" className="bg-blue-600 text-white hover:bg-blue-700 text-sm px-3 py-2">
              <Plus className="w-4 h-4 md:mr-1.5" />
              <span className="hidden sm:inline">New Invoice</span>
            </LinkButton>
          </div>

          {/* Search + chips + date */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search invoice or patient..."
                className="pl-9 bg-white" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {FILTER_CHIPS.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === f.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}>
                  {f.label}
                </button>
              ))}
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-7 border border-slate-200 rounded-full px-2.5 text-xs bg-white text-slate-600 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {dateFrom && (
                <button onClick={() => setDateFrom("")}
                  className="text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 bg-white whitespace-nowrap shrink-0">
                  Clear date
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {rows.length === 0 && !loading ? (
              <div className="px-4 py-14 text-center">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-400 text-sm">No invoices found</p>
                <a href="/billing" className="text-blue-600 text-sm hover:underline mt-1 inline-block">Create first invoice →</a>
              </div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <div className="md:hidden divide-y divide-slate-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="p-4 space-y-2">
                        <div className="flex justify-between">
                          <div className="h-4 bg-slate-100 rounded w-28 animate-pulse" />
                          <div className="h-5 w-14 bg-slate-100 rounded animate-pulse" />
                        </div>
                        <div className="h-3 bg-slate-100 rounded w-36 animate-pulse" />
                        <div className="h-3 bg-slate-100 rounded w-20 animate-pulse" />
                      </div>
                    ))
                  ) : (
                    rows.map(r => {
                      const isPending = r.payment_status === "pending" || r.payment_status === "partial";
                      return (
                        <div key={r.id} className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {r.invoice_number}
                            </span>
                            <Badge className={`text-[10px] border ml-2 ${STATUS[r.payment_status] ?? STATUS.pending}`}>
                              {r.payment_status}
                            </Badge>
                          </div>
                          <p className="font-semibold text-slate-800 text-sm">{r.patient_name}</p>
                          <p className="text-xs text-slate-400 mb-2">
                            {r.patient_code} · {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-800">₹{r.total_amount.toLocaleString("en-IN")}</p>
                              {r.amount_paid > 0 && r.payment_status !== "paid" && (
                                <p className="text-xs text-red-500">₹{(r.total_amount - r.amount_paid).toLocaleString("en-IN")} remaining</p>
                              )}
                            </div>
                            {isPending && (
                              <div className="flex gap-2">
                                <button onClick={() => setPayingInvoice(r)}
                                  className="flex items-center gap-1 text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 active:bg-blue-100 transition-colors">
                                  <CreditCard className="w-3.5 h-3.5" /> Pay
                                </button>
                                <button onClick={() => sendReminder(r)}
                                  className="flex items-center gap-1 text-xs text-green-600 font-semibold px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 active:bg-green-100 transition-colors">
                                  <MessageCircle className="w-3.5 h-3.5" /> Remind
                                </button>
                              </div>
                            )}
                            {!isPending && <ChevronRight className="w-4 h-4 text-slate-300" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Invoice No.", "Patient", "Date", "Amount", "Mode", "Status", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(7)].map((__, j) => (
                              <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        rows.map(r => {
                          const isPending = r.payment_status === "pending" || r.payment_status === "partial";
                          return (
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
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-800">₹{r.total_amount.toLocaleString("en-IN")}</p>
                                {r.amount_paid > 0 && r.payment_status !== "paid" && (
                                  <p className="text-xs text-red-500">₹{(r.total_amount - r.amount_paid).toLocaleString("en-IN")} remaining</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600 capitalize">{r.payment_mode ?? "—"}</td>
                              <td className="px-4 py-3">
                                <Badge className={`text-xs border ${STATUS[r.payment_status] ?? STATUS.pending}`}>
                                  {r.payment_status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {isPending && (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => setPayingInvoice(r)}
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 font-medium px-2 py-1 rounded-md border border-blue-200 transition-colors whitespace-nowrap">
                                      <CreditCard className="w-3 h-3" /> Pay
                                    </button>
                                    <button onClick={() => sendReminder(r)}
                                      className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 font-medium px-2 py-1 rounded-md border border-green-200 transition-colors">
                                      <MessageCircle className="w-3 h-3" /> Remind
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {payingInvoice && (
        <RecordPaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => { setPayingInvoice(null); load(); }}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return <Suspense><InvoicesInner /></Suspense>;
}
