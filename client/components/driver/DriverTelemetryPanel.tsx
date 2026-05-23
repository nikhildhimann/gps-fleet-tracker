"use client";

import React from "react";

export default function DriverTelemetryPanel() {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[#0b1630] p-6 text-slate-100 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-purple-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-pink-500/30 blur-3xl" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
            Vehicle Telemetry
          </p>
          <h3 className="text-2xl font-black text-white">Driver Analytics</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
          Live Snapshot
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-br from-[#141c3b] via-[#1b2345] to-[#101833] p-6">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Vehicle Top View
          </div>
          <div className="relative mx-auto h-56 max-w-md">
            <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-gradient-to-r from-purple-500/10 via-transparent to-pink-500/10" />
            <div className="absolute inset-0 grid grid-cols-8 gap-2 opacity-30">
              {Array.from({ length: 32 }).map((_, idx) => (
                <div key={idx} className="h-full rounded-sm border border-white/5" />
              ))}
            </div>
            <div className="absolute left-1/2 top-4 h-48 w-32 -translate-x-1/2 rounded-[38px] bg-gradient-to-b from-purple-600/60 via-slate-600/30 to-pink-500/60 shadow-[0_10px_40px_rgba(15,23,42,0.6)]">
              <div className="absolute left-1/2 top-3 h-8 w-20 -translate-x-1/2 rounded-[14px] bg-slate-200/20" />
              <div className="absolute left-1/2 top-16 h-10 w-20 -translate-x-1/2 rounded-[16px] bg-slate-200/15" />
              <div className="absolute left-1/2 bottom-5 h-8 w-20 -translate-x-1/2 rounded-[14px] bg-slate-200/20" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Trip Score
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-3/4 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              </div>
              <div className="mt-2 text-sm font-bold text-emerald-200">76%</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Efficiency
              </div>
              <div className="mt-2 flex items-end gap-1">
                {[5, 8, 6, 9, 4, 7].map((value, idx) => (
                  <div
                    key={idx}
                    className="w-3 rounded-full bg-gradient-to-b from-pink-400 to-purple-600"
                    style={{ height: `${value * 6}px` }}
                  />
                ))}
              </div>
              <div className="mt-2 text-sm font-bold text-pink-200">A-</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Motion Waves
            </div>
            <div className="relative h-28 overflow-hidden rounded-2xl bg-[#0f1b36]">
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                Live waveforms
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-emerald-500/30 to-transparent" />
              <div className="absolute inset-0">
                <svg viewBox="0 0 400 120" className="h-full w-full">
                  <path
                    d="M0,60 C40,20 80,100 120,60 C160,20 200,100 240,60 C280,20 320,100 360,60"
                    stroke="#a855f7"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.8"
                  />
                  <path
                    d="M0,80 C50,40 100,100 150,80 C200,60 250,120 300,80 C350,40 400,100 450,80"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Performance Split
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-[#0f1b36] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Speed</div>
                <div className="mt-3 h-16 rounded-xl border border-white/10 bg-gradient-to-b from-pink-500/30 to-transparent" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0f1b36] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">RPM</div>
                <div className="mt-3 flex gap-2">
                  <div className="h-12 w-3 rounded-full bg-purple-500/70" />
                  <div className="h-20 w-3 rounded-full bg-cyan-400/70" />
                  <div className="h-14 w-3 rounded-full bg-pink-400/70" />
                  <div className="h-18 w-3 rounded-full bg-emerald-400/70" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Driver Gauges
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Speed", value: "62", unit: "km/h", color: "from-purple-400 to-cyan-400" },
                { label: "Fuel", value: "48", unit: "%", color: "from-emerald-400 to-lime-300" },
                { label: "Temp", value: "31", unit: "°C", color: "from-pink-400 to-orange-300" },
              ].map((gauge) => (
                <div
                  key={gauge.label}
                  className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0f1b36] p-4 text-center"
                >
                  <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${gauge.color} p-[2px]`}>
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0b1630] text-lg font-black">
                      {gauge.value}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {gauge.label}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">{gauge.unit}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
