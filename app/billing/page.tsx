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
import {
  Search, Plus, X, Receipt, Download,
  MessageCircle, ChevronDown, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Patient = { id: string; patient_code: string; full_name: string; phone: string; age: number | null; gender: string | null };
type LisTest  = { id: string; test_code: string; test_name: string; price: number; department: string | null };
type CartItem = LisTest & { qty: number };

type SavedInvoice = {
  invoice_number: string;
  patient: Patient;
  items: CartItem[];
  subtotal: number;
  discount_percent: number;
  gst_applicable: boolean;
  gst_amount: number;
  total_amount: number;
  payment_mode: string;
  payment_status: string;
  created_at: string;
  referring_doctor: string | null;
};

const LAB_WA = "919182147180";

function BillingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get("patient");

  // Patient
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  // Tests
  const [allTests, setAllTests] = useState<LisTest[]>([]);
  const [testQuery, setTestQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Billing options
  const [discountPct, setDiscountPct] = useState(0);
  const [gstApplicable, setGstApplicable] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");

  // State
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<SavedInvoice | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
    });
    supabase.from("lis_tests").select("*").eq("is_active", true).order("test_name")
      .then(({ data }) => setAllTests(data || []));
    if (preselectedPatientId) loadPatient(preselectedPatientId);
  }, []); // eslint-disable-line

  async function loadPatient(pid: string) {
    const { data } = await supabase.from("lis_patients")
      .select("id, patient_code, full_name, phone, age, gender").eq("id", pid).single();
    if (data) setSelectedPatient(data as Patient);
  }

  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setPatientResults([]); return; }
    const { data } = await supabase.from("lis_patients")
      .select("id, patient_code, full_name, phone, age, gender")
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`)
      .limit(8);
    setPatientResults(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientQuery), 250);
    return () => clearTimeout(t);
  }, [patientQuery, searchPatients]);

  // Calculations
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = gstApplicable ? Math.round(afterDiscount * 0.18) : 0;
  const total = afterDiscount + gstAmt;

  const filteredTests = allTests.filter(t =>
    !cart.find(c => c.id === t.id) &&
    (testQuery === "" || t.test_name.toLowerCase().includes(testQuery.toLowerCase()) ||
      t.test_code.toLowerCase().includes(testQuery.toLowerCase()))
  );

  async function handleGenerate() {
    if (!selectedPatient) { toast.error("Select a patient first"); return; }
    if (cart.length === 0) { toast.error("Add at least one test"); return; }
    setSaving(true);

    const { data: seqData } = await supabase.rpc("next_invoice_number");
    const invoice_number = seqData ?? `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const { data: inv, error } = await supabase.from("lis_invoices").insert({
      invoice_number,
      patient_id:     selectedPatient.id,
      subtotal,
      discount_percent: discountPct,
      gst_applicable:   gstApplicable,
      gst_amount:       gstAmt,
      total_amount:     total,
      amount_paid:      paymentStatus === "paid" ? total : 0,
      payment_mode:     paymentMode,
      payment_status:   paymentStatus,
    }).select("id").single();

    if (error || !inv) { toast.error("Failed to create invoice"); setSaving(false); return; }

    await supabase.from("lis_invoice_items").insert(
      cart.map(item => ({
        invoice_id: inv.id,
        test_id:    item.id,
        item_name:  item.test_name,
        price:      item.price,
        quantity:   item.qty,
      }))
    );

    setSavedInvoice({
      invoice_number,
      patient: selectedPatient,
      items: cart,
      subtotal,
      discount_percent: discountPct,
      gst_applicable: gstApplicable,
      gst_amount: gstAmt,
      total_amount: total,
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      created_at: new Date().toISOString(),
      referring_doctor: null,
    });
    setSaving(false);
    toast.success(`Invoice ${invoice_number} created!`);
  }

  function buildReceiptHtml(inv: SavedInvoice) {
    const rows = inv.items.map(i =>
      `<tr>
        <td style="padding:6px 0;color:#334155">${i.test_name}</td>
        <td style="padding:6px 0;text-align:center;color:#64748b">${i.qty}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b">₹${i.price.toLocaleString("en-IN")}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#1e293b">₹${(i.price*i.qty).toLocaleString("en-IN")}</td>
      </tr>`
    ).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Invoice ${inv.invoice_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f1f5f9;padding:20px}
  .card{max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.1)}
  .header{background:linear-gradient(135deg,#1d4ed8,#0891b2);color:#fff;padding:24px}
  .lab{font-size:20px;font-weight:700}.sub{color:#bfdbfe;font-size:11px;margin-top:2px}
  .inv-bar{display:flex;justify-content:space-between;padding:14px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  .inv-no{font-size:22px;font-weight:700;color:#2563eb;font-family:monospace}
  .section{padding:16px 24px;border-bottom:1px dashed #e2e8f0}
  .sec-title{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}.th{font-size:10px;color:#94a3b8;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .total-row td{padding-top:10px;font-weight:700;font-size:14px;border-top:1px solid #e2e8f0}
  .total-row td:last-child{color:#2563eb;font-size:18px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px}
  .paid{background:#dcfce7;color:#166534}.pending{background:#fef3c7;color:#92400e}
  .footer{text-align:center;padding:14px;color:#94a3b8;font-size:11px;background:#f8fafc}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none;max-width:100%}}
</style></head><body><div class="card">
<div class="header">
  <div class="lab">🔬 Lohith Path Labs</div>
  <div class="sub">Advanced Quality Testing · Hussainpur, Medak, Telangana</div>
  <div style="font-size:11px;color:#bfdbfe;margin-top:8px">TAX INVOICE</div>
</div>
<div class="inv-bar">
  <div><div style="font-size:10px;color:#94a3b8">Invoice No.</div><div class="inv-no">${inv.invoice_number}</div></div>
  <div style="text-align:right"><div style="font-size:10px;color:#94a3b8">Date</div><div style="font-size:13px;font-weight:600;color:#334155">${format(new Date(inv.created_at), "dd MMM yyyy")}</div></div>
</div>
<div class="section">
  <div class="sec-title">Patient Details</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
    <div><div style="font-size:11px;color:#94a3b8">Name</div><div style="font-weight:600;color:#1e293b">${inv.patient.full_name}</div></div>
    <div><div style="font-size:11px;color:#94a3b8">Patient ID</div><div style="font-weight:600;color:#2563eb;font-family:monospace">${inv.patient.patient_code}</div></div>
    <div><div style="font-size:11px;color:#94a3b8">Mobile</div><div style="font-weight:600;color:#1e293b">+91 ${inv.patient.phone}</div></div>
    ${inv.patient.age ? `<div><div style="font-size:11px;color:#94a3b8">Age</div><div style="font-weight:600;color:#1e293b">${inv.patient.age} yrs ${inv.patient.gender ? `· ${inv.patient.gender === "M" ? "Male" : "Female"}` : ""}</div></div>` : ""}
  </div>
</div>
<div class="section">
  <div class="sec-title">Tests Performed</div>
  <table>
    <tr class="th"><th style="text-align:left">Test Name</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>
    ${rows}
    ${inv.discount_percent > 0 ? `<tr><td colspan="3" style="padding-top:8px;color:#64748b;font-size:12px">Subtotal</td><td style="text-align:right;padding-top:8px">₹${inv.subtotal.toLocaleString("en-IN")}</td></tr>
    <tr><td colspan="3" style="color:#dc2626;font-size:12px">Discount (${inv.discount_percent}%)</td><td style="text-align:right;color:#dc2626">-₹${(inv.subtotal - inv.subtotal*(1-inv.discount_percent/100)).toFixed(0)}</td></tr>` : ""}
    ${inv.gst_applicable ? `<tr><td colspan="3" style="color:#64748b;font-size:12px">GST (18%)</td><td style="text-align:right">₹${inv.gst_amount.toLocaleString("en-IN")}</td></tr>` : ""}
    <tr class="total-row"><td colspan="3">Total Amount</td><td style="text-align:right">₹${inv.total_amount.toLocaleString("en-IN")}</td></tr>
  </table>
</div>
<div class="section" style="border-bottom:none">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:11px;color:#94a3b8">Payment Mode</div>
      <div style="font-size:13px;font-weight:600;color:#1e293b;text-transform:capitalize">${inv.payment_mode}</div>
    </div>
    <span class="badge ${inv.payment_status}">${inv.payment_status.toUpperCase()}</span>
  </div>
</div>
<div class="footer">Thank you for choosing Lohith Path Labs · +91 91821 47180 · lohithpathlabs.in</div>
</div></body></html>`;
  }

  function downloadInvoice(inv: SavedInvoice) {
    const html = buildReceiptHtml(inv);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${inv.invoice_number}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sendWhatsApp(inv: SavedInvoice) {
    const msg = [
      `Hello ${inv.patient.full_name}! 👋`,
      ``,
      `Your invoice from *Lohith Path Labs* is ready.`,
      ``,
      `📋 *Invoice:* ${inv.invoice_number}`,
      `🧪 *Tests:* ${inv.items.map(i => i.test_name).join(", ")}`,
      `💰 *Total:* ₹${inv.total_amount.toLocaleString("en-IN")}`,
      `💳 *Payment:* ${inv.payment_mode} — ${inv.payment_status}`,
      ``,
      `For reports, visit: lohithpathlabs.in/reports`,
      `Booking ID: ${inv.patient.patient_code}`,
    ].join("\n");
    window.open(`https://wa.me/${inv.patient.phone.replace(/\D/g, "") ? "91" + inv.patient.phone : LAB_WA}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // ── Invoice generated screen ────────────────────────────────────────────────
  if (savedInvoice) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Invoice Generated" />
          <main className="flex-1 p-6 flex items-start justify-center">
            <div className="max-w-lg w-full space-y-4 mt-4">
              <div className="flex items-center gap-3 text-green-600 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <CheckCircle className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-bold">Invoice Created Successfully!</p>
                  <p className="text-sm text-green-700">{savedInvoice.invoice_number} · ₹{savedInvoice.total_amount.toLocaleString("en-IN")}</p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-blue-600 text-lg">{savedInvoice.invoice_number}</p>
                      <p className="text-slate-600 text-sm">{savedInvoice.patient.full_name} · {savedInvoice.patient.patient_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800 text-xl">₹{savedInvoice.total_amount.toLocaleString("en-IN")}</p>
                      <Badge className={`text-xs ${savedInvoice.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {savedInvoice.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3">
                  <p className="text-xs text-slate-500 mb-2">Tests</p>
                  {savedInvoice.items.map(i => (
                    <div key={i.id} className="flex justify-between text-sm py-0.5">
                      <span className="text-slate-700">{i.test_name}</span>
                      <span className="text-slate-600 font-medium">₹{i.price.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => downloadInvoice(savedInvoice)} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" /> Download Invoice
                </Button>
                <Button onClick={() => sendWhatsApp(savedInvoice)}
                  className="flex-1 bg-green-600 hover:bg-green-700">
                  <MessageCircle className="w-4 h-4 mr-2" /> Send WhatsApp
                </Button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setSelectedPatient(null); setCart([]); setDiscountPct(0);
                  setGstApplicable(false); setPaymentMode("cash"); setPaymentStatus("paid");
                  setSavedInvoice(null);
                }}>
                  New Invoice
                </Button>
                <LinkButton href="/billing/invoices" variant="outline" className="flex-1 justify-center">
                  View All Invoices
                </LinkButton>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── New invoice form ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="New Invoice" />
        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-5">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">New Invoice</h2>
                <p className="text-slate-500 text-sm">Select patient → add tests → generate</p>
              </div>
              <LinkButton href="/billing/invoices" variant="outline" size="sm">
                <Receipt className="w-4 h-4 mr-1.5" /> View Invoices
              </LinkButton>
            </div>

            {/* Step 1 — Patient */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Select Patient
              </h3>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{selectedPatient.full_name}</p>
                    <p className="text-xs text-slate-500">{selectedPatient.patient_code} · +91 {selectedPatient.phone}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={patientQuery}
                      onChange={e => { setPatientQuery(e.target.value); setPatientSearchOpen(true); }}
                      onFocus={() => setPatientSearchOpen(true)}
                      placeholder="Search patient by name, phone, or ID..."
                      className="pl-9"
                    />
                  </div>
                  {patientSearchOpen && patientResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientQuery(""); setPatientSearchOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-blue-700 text-xs font-bold">{p.full_name[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{p.full_name}</p>
                            <p className="text-xs text-slate-400">{p.patient_code} · {p.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    New patient?{" "}
                    <a href="/patients/new" className="text-blue-600 hover:underline">Register first →</a>
                  </p>
                </div>
              )}
            </div>

            {/* Step 2 — Tests */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Add Tests
              </h3>

              {/* Test search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={testQuery} onChange={e => setTestQuery(e.target.value)}
                  placeholder="Search tests (e.g. CBC, Thyroid, Vitamin D)..."
                  className="pl-9" />
              </div>

              {/* Test results */}
              {testQuery && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-3 max-h-52 overflow-y-auto">
                  {filteredTests.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400 text-center">No tests found</p>
                  ) : (
                    filteredTests.slice(0, 10).map(t => (
                      <button key={t.id} onClick={() => { setCart(c => [...c, { ...t, qty: 1 }]); setTestQuery(""); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{t.test_name}</p>
                          <p className="text-xs text-slate-400">{t.test_code} · {t.department}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-slate-700 text-sm">₹{t.price.toLocaleString("en-IN")}</span>
                          <Plus className="w-4 h-4 text-blue-600" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 ? (
                <div className="space-y-2">
                  {cart.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center shrink-0">{idx+1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.test_name}</p>
                          <p className="text-xs text-slate-400">₹{item.price.toLocaleString("en-IN")} each</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-700 text-sm">₹{(item.price * item.qty).toLocaleString("en-IN")}</span>
                        <button onClick={() => setCart(c => c.filter(x => x.id !== item.id))}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-slate-400 text-sm">Search and add tests above</p>
              )}
            </div>

            {/* Step 3 — Billing options */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                Billing Options
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Discount %</Label>
                  <div className="relative">
                    <Input type="number" min="0" max="100" value={discountPct}
                      onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="pr-6 text-sm" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">GST 18%</Label>
                  <button onClick={() => setGstApplicable(g => !g)}
                    className={`w-full h-10 rounded-md border text-sm font-medium transition-colors ${gstApplicable ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}>
                    {gstApplicable ? "Applied ✓" : "Apply GST"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Payment Mode</Label>
                  <div className="relative">
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                      className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {["cash", "upi", "card", "pending"].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Payment Status</Label>
                  <div className="relative">
                    <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                      className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {["paid", "pending", "partial"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Totals */}
              {cart.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm border border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount ({discountPct}%)</span><span>-₹{discountAmt.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {gstApplicable && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST (18%)</span><span>₹{gstAmt.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
                    <span>Total</span><span className="text-blue-600">₹{total.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleGenerate} disabled={saving || !selectedPatient || cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-base">
              {saving ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return <Suspense><BillingInner /></Suspense>;
}
