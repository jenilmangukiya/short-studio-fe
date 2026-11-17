"use client";

import type { VideoMetricsSummary, VideoSortOption, VideoViewMode } from "@/lib/video-ui";

interface VideoToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: VideoSortOption;
  onSortChange: (sort: VideoSortOption) => void;
  viewMode: VideoViewMode;
  onViewModeChange: (mode: VideoViewMode) => void;
  metrics: VideoMetricsSummary;
  filteredCount: number;
}

export function VideoToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  metrics,
  filteredCount,
}: VideoToolbarProps) {
  const filterTabs = [
    { id: "all", label: "All", count: metrics.total },
    { id: "completed", label: "Ready", count: metrics.completed },
    { id: "in_progress", label: "In Production", count: metrics.inProgress },
    { id: "draft", label: "Drafts", count: metrics.draft },
    ...(metrics.failed > 0
      ? [{ id: "failed", label: "Failed", count: metrics.failed }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Top Row: Search Input + Sort + Layout Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search shorts by topic or description..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-300 bg-white text-xs placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right side controls: Sort & View Toggle */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="hidden md:inline font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as VideoSortOption)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Alphabetical (A–Z)</option>
            </select>
          </div>

          {/* View Mode Switcher (Grid vs List) */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`p-1.5 rounded-md text-xs transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
              title="List View"
              aria-label="List View"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" />
                <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" />
                <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round" />
                <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" strokeWidth="3" />
                <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" strokeWidth="3" />
                <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Filter Tabs & Results Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-200/80 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    isActive
                      ? "bg-slate-800 text-slate-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-slate-700 font-semibold">{filteredCount}</span> of {metrics.total} shorts
        </div>
      </div>
    </div>
  );
}
