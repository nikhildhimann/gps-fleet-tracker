"use client";

import { useEffect, useMemo, useState } from "react";
import Table from "@/components/ui/Table";

const invoices = [
  { id: "INV-2201", org: "Ajiva Tracker", amount: "₹45,600", status: "paid", due: "Apr 28, 2024", cycle: "Apr 01 - Apr 30" },
  { id: "INV-2202", org: "North Branch", amount: "₹12,800", status: "pending", due: "May 04, 2024", cycle: "Apr 01 - Apr 30" },
  { id: "INV-2203", org: "West Branch", amount: "₹8,400", status: "overdue", due: "Apr 18, 2024", cycle: "Mar 01 - Mar 31" },
  { id: "INV-2204", org: "South Hub", amount: "₹16,200", status: "pending", due: "May 09, 2024", cycle: "Apr 01 - Apr 30" },
];

const payments = [
  { id: "PAY-1122", org: "Ajiva Tracker", method: "UPI", amount: "₹45,600", status: "received", time: "Today, 10:24 AM", reference: "UTR 99820121" },
  { id: "PAY-1123", org: "North Branch", method: "Card", amount: "₹12,800", status: "processing", time: "Yesterday, 6:10 PM", reference: "Visa 4821" },
  { id: "PAY-1124", org: "West Branch", method: "Bank Transfer", amount: "₹8,400", status: "failed", time: "Apr 18, 2024", reference: "UTR 88410291" },
  { id: "PAY-1125", org: "South Hub", method: "NetBanking", amount: "₹16,200", status: "received", time: "Apr 19, 2024", reference: "HDFC 3321" },
];

const billingSummary = [
  { id: "sum_1", label: "Outstanding", value: "₹21,200", sublabel: "2 invoices pending" },
  { id: "sum_2", label: "Collected", value: "₹45,600", sublabel: "Last 30 days" },
  { id: "sum_3", label: "Overdue", value: "₹8,400", sublabel: "1 invoice overdue" },
];

export default function BillingPage() {
  const [activeView, setActiveView] = useState<"invoices" | "payments">("invoices");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setStatusFilter("all");
  }, [activeView]);

  const columns = [
    { header: "Invoice", accessor: "id" },
    { header: "Organization", accessor: "org" },
    { header: "Amount", accessor: "amount" },
    { header: "Cycle", accessor: "cycle" },
    { header: "Due Date", accessor: "due" },
    {
      header: "Status",
      accessor: (row: any) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${row.status === "paid"
            ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200"
            : row.status === "pending"
              ? "border-amber-500/30 bg-amber-500/20 text-amber-200"
              : "border-rose-500/30 bg-rose-500/20 text-rose-200"
          }`}>
          {row.status}
        </span>
      ),
    },
  ];

  const paymentColumns = [
    { header: "Payment ID", accessor: "id" },
    { header: "Organization", accessor: "org" },
    { header: "Method", accessor: "method" },
    { header: "Reference", accessor: "reference" },
    { header: "Amount", accessor: "amount" },
    { header: "Timestamp", accessor: "time" },
    {
      header: "Status",
      accessor: (row: any) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${row.status === "received"
            ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200"
            : row.status === "processing"
              ? "border-amber-500/30 bg-amber-500/20 text-amber-200"
              : "border-rose-500/30 bg-rose-500/20 text-rose-200"
          }`}>
          {row.status}
        </span>
      ),
    },
  ];

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return invoices;
    return invoices.filter((invoice) => invoice.status === statusFilter);
  }, [statusFilter]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === "all") return payments;
    return payments.filter((payment) => payment.status === statusFilter);
  }, [statusFilter]);

  const statusOptions =
    activeView === "invoices"
      ? ["all", "paid", "pending", "overdue"]
      : ["all", "received", "processing", "failed"];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">Finance</p>
        <h1 className="text-2xl font-black text-slate-100">Billing & Payments</h1>
        <p className="text-sm text-slate-400">Review invoices and settlements in one place.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {billingSummary.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{item.value}</p>
            <p className="text-xs text-slate-400">{item.sublabel}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="flex flex-wrap gap-2">
          {(["invoices", "payments"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${activeView === view
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-800/80 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
            >
              {view}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-800/80 bg-slate-950/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All Status" : status}
            </option>
          ))}
        </select>
      </div>
      {activeView === "invoices" ? (
        <Table columns={columns as any} data={filteredInvoices as any[]} loading={false} variant="dark" />
      ) : (
        <Table columns={paymentColumns as any} data={filteredPayments as any[]} loading={false} variant="dark" />
      )}
    </div>
  );
}
