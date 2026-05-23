"use client";
import React from "react";
import { Play, Pause, Square, PowerOff, Database, List,Users2 } from "lucide-react";

interface StatusCardsProps {
    stats: {
        running: number;
        idle: number;
        stopped: number;
        inactive: number;
        noData: number;
        total: number;
        organizations: number;
    };
    onCardClick?: (label: string) => void;
}

export default function StatusCards({ stats, onCardClick }: StatusCardsProps) {
    const cards = [
        { label: "Organizations", count: stats.organizations, icon: Users2, color: "bg-violet-50", iconColor: "text-violet-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "Running", count: stats.running, icon: Play, color: "bg-emerald-50", iconColor: "text-emerald-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "Idle", count: stats.idle, icon: Pause, color: "bg-amber-50", iconColor: "text-amber-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "Stopped", count: stats.stopped, icon: Square, color: "bg-rose-50", iconColor: "text-rose-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "Inactive", count: stats.inactive, icon: PowerOff, color: "bg-slate-100", iconColor: "text-slate-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "No Data", count: stats.noData, icon: Database, color: "bg-slate-50", iconColor: "text-slate-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
        { label: "Total", count: stats.total, icon: List, color: "bg-blue-50", iconColor: "text-blue-700", labelColor: "text-slate-500", countColor: "text-slate-950" },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            {cards.map((card) => (
                <div 
                    key={card.label} 
                    onClick={() => onCardClick?.(card.label)}
                    className={`${card.color} flex cursor-pointer flex-col gap-4 rounded-[22px] border border-slate-200 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]`}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-slate-200/70">
                        <card.icon size={22} className={card.iconColor} />
                    </div>
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.26em] ${card.labelColor || "text-slate-500"}`}>{card.label}</span>
                        <div className={`mt-2 text-3xl font-black tracking-tight ${card.countColor || "text-slate-950"}`}>{card.count}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
