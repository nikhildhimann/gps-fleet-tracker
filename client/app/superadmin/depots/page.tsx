"use client";

import { useMemo, useState } from "react";
import Table from "@/components/ui/Table";

const depots = [
  {
    id: "dep_1",
    name: "Delhi Central Depot",
    city: "New Delhi",
    capacity: 120,
    manager: "Isha Verma",
    status: "active",
    address: "Karol Bagh, New Delhi",
  },
  {
    id: "dep_2",
    name: "Chandigarh North Depot",
    city: "Chandigarh",
    capacity: 80,
    manager: "Harsh Singh",
    status: "active",
    address: "Sector 17, Chandigarh",
  },
  {
    id: "dep_3",
    name: "Jaipur West Depot",
    city: "Jaipur",
    capacity: 64,
    manager: "Neha Rathore",
    status: "maintenance",
    address: "MI Road, Jaipur",
  },
];

export default function DepotsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const metrics = useMemo(
    () => [
      { label: "Total Depots", value: depots.length.toString(), sublabel: "Across regions" },
      { label: "Active Bays", value: "182", sublabel: "In service today" },
      { label: "Scheduled Maintenance", value: "1", sublabel: "Next 7 days" },
    ],
    []
  );

  const filteredDepots = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    return depots.filter((depot) => {
      const matchesStatus = statusFilter === "all" || depot.status === statusFilter;
      const matchesSearch =
        !trimmed ||
        depot.name.toLowerCase().includes(trimmed) ||
        depot.city.toLowerCase().includes(trimmed);
      return matchesStatus && matchesSearch;
    });
  }, [statusFilter, searchTerm]);

  const columns = [
    { header: "Depot", accessor: "name" },
    { header: "City", accessor: "city" },
    { header: "Capacity", accessor: (row: any) => `${row.capacity} slots` },
    { header: "Manager", accessor: "manager" },
    {
      header: "Status",
      accessor: (row: any) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${row.status === "active"
              ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/20 text-amber-200"
            }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">Operations</p>
        <h1 className="text-2xl font-black text-slate-100">Depots</h1>
        <p className="text-sm text-slate-400">Track depot capacity, managers, and service readiness.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{metric.value}</p>
            <p className="text-xs text-slate-400">{metric.sublabel}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "maintenance"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${statusFilter === status
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-800/80 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
            >
              {status}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search depots..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full max-w-xs rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>
      <Table columns={columns as any} data={filteredDepots as any[]} loading={false} variant="dark" />
      <div className="grid gap-4 md:grid-cols-3">
        {filteredDepots.map((depot) => (
          <div key={depot.id} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{depot.city}</p>
            <h2 className="mt-2 text-lg font-black text-slate-100">{depot.name}</h2>
            <p className="text-xs text-slate-400">{depot.address}</p>
            <div className="mt-3 text-xs text-slate-300">
              <p>Manager: {depot.manager}</p>
              <p>Capacity: {depot.capacity} slots</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
