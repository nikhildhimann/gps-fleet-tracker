"use client";

import { useMemo, useState } from "react";
import { 
  Radio, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info
} from "lucide-react";
import { useGetAdminNotificationsQuery } from "@/redux/api/adminNotificationsApi";
import { formatDateTime } from "@/components/superadmin/superadmin-data";

export default function SuperAdminHistoryPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, isFetching } = useGetAdminNotificationsQuery({
    page,
    limit,
    search: searchTerm,
    type: typeFilter === "all" ? undefined : typeFilter as any,
  }, { refetchOnMountOrArgChange: true });

  const activities = useMemo(() => data?.data || [], [data]);
  const total = data?.pagination?.totalrecords || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
            System Logs
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">Platform Activity</h1>
          <p className="text-sm font-medium text-slate-400">
            Real-time oversight of critical platform events and administrative actions.
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 overflow-hidden shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
        <div className="border-b border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search history by message or type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-200 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <Filter className="shrink-0 text-slate-500" size={16} />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-3 pr-8 text-sm font-black uppercase tracking-widest text-slate-300 outline-none transition focus:border-emerald-500/40"
              >
                <option value="all">All Types</option>
                <option value="admin">Administrative</option>
                <option value="mapping">Hardware Mapping</option>
                <option value="import">Data Imports</option>
                <option value="alert">System Alerts</option>
              </select>
            </div>
          </div>
        </div>

        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : activities.length > 0 ? (
            <div className="divide-y divide-slate-800/60">
              {activities.map((item: any) => (
                <div key={item._id} className="group flex flex-col gap-4 p-5 transition hover:bg-slate-800/20 sm:flex-row sm:items-start sm:gap-6">
                  <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${getSeverityStyles(item.severity)}`}>
                    {getSeverityIcon(item.severity)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-black text-slate-100">{item.title || "System Event"}</p>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {formatDateTime(item.occurredAt || item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-400">{item.message}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {item.type || "system"}
                      </span>
                      {item.organizationId && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          Org Linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-96 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
                <Search size={24} />
              </div>
              <p className="mt-4 text-sm font-black text-slate-400">No events found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Showing {activities.length} of {total} events
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1 || isFetching}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-3 text-xs font-black text-slate-100">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages || isFetching}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical": return <AlertCircle size={18} />;
    case "warning": return <AlertCircle size={18} />;
    case "success": return <CheckCircle2 size={18} />;
    default: return <Info size={18} />;
  }
}

function getSeverityStyles(severity: string) {
  switch (severity) {
    case "critical": return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    case "warning": return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "success": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    default: return "border-slate-700 bg-slate-800/30 text-slate-400";
  }
}
