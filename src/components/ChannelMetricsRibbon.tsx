"use client";

import type { VideoMetricsSummary } from "@/lib/video-ui";

interface ChannelMetricsRibbonProps {
  metrics: VideoMetricsSummary;
}

export function ChannelMetricsRibbon({ metrics }: ChannelMetricsRibbonProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Shorts */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium tracking-wide">Total Shorts</span>
          <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-sm">
            🎬
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {metrics.total}
          </span>
          <span className="text-xs text-slate-400 font-medium">videos</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>{metrics.completionRate}% completion rate</span>
        </div>
      </div>

      {/* 2. Ready to Export / Completed */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-emerald-200 transition">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium tracking-wide">Ready to Export</span>
          <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 text-sm">
            ✓
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600 tracking-tight">
            {metrics.completed}
          </span>
          <span className="text-xs text-emerald-700/60 font-medium">finished</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Burned-in captioned & ready to post
        </div>
      </div>

      {/* 3. In Production */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-indigo-200 transition">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium tracking-wide">In Production</span>
          <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-sm">
            ⚙️
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-indigo-600 tracking-tight">
            {metrics.inProgress}
          </span>
          <span className="text-xs text-indigo-700/60 font-medium">active</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          {metrics.inProgress > 0 ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
              </span>
              <span className="text-indigo-600 font-medium">Generating or reviewing</span>
            </>
          ) : (
            <span className="text-slate-400">No active jobs in flight</span>
          )}
        </div>
      </div>

      {/* 4. Drafts & Needs Attention */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium tracking-wide">Drafts & Queued</span>
          <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-sm">
            📝
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-800 tracking-tight">
            {metrics.draft + metrics.failed}
          </span>
          <span className="text-xs text-slate-400 font-medium">queued</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {metrics.failed > 0 ? (
            <span className="text-rose-600 font-medium">
              ⚠️ {metrics.failed} {metrics.failed === 1 ? "failed item" : "failed items"}
            </span>
          ) : (
            <span>Ready to start pipeline</span>
          )}
        </div>
      </div>
    </div>
  );
}
