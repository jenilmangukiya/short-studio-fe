import type { VideoSummary, VideoStatus } from "./types";

export type VideoSortOption = "newest" | "oldest" | "title";
export type VideoViewMode = "grid" | "list";

export interface VideoStatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
  dotColor: string;
  isAnimated: boolean;
}

export function getVideoStatusConfig(status: string): VideoStatusConfig {
  switch (status as VideoStatus) {
    case "completed":
      return {
        label: "Ready",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs",
        dotColor: "bg-emerald-500",
        isAnimated: false,
      };
    case "in_progress":
      return {
        label: "In Production",
        bgClass: "bg-indigo-50",
        textClass: "text-indigo-700",
        borderClass: "border-indigo-200",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs",
        dotColor: "bg-indigo-600",
        isAnimated: true,
      };
    case "failed":
      return {
        label: "Failed",
        bgClass: "bg-rose-50",
        textClass: "text-rose-700",
        borderClass: "border-rose-200",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200 shadow-xs",
        dotColor: "bg-rose-500",
        isAnimated: false,
      };
    case "draft":
    default:
      return {
        label: "Draft",
        bgClass: "bg-slate-50",
        textClass: "text-slate-700",
        borderClass: "border-slate-200",
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
        dotColor: "bg-slate-400",
        isAnimated: false,
      };
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return "Just now";

    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return "Just now";

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}

export function formatFullDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export interface VideoMetricsSummary {
  total: number;
  completed: number;
  inProgress: number;
  draft: number;
  failed: number;
  completionRate: number;
}

export function computeVideoMetrics(videos: VideoSummary[] = []): VideoMetricsSummary {
  const total = videos.length;
  let completed = 0;
  let inProgress = 0;
  let draft = 0;
  let failed = 0;

  for (const v of videos) {
    if (v.status === "completed") completed++;
    else if (v.status === "in_progress") inProgress++;
    else if (v.status === "failed") failed++;
    else draft++;
  }

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    inProgress,
    draft,
    failed,
    completionRate,
  };
}

export function filterAndSortVideos(
  videos: VideoSummary[] = [],
  searchQuery: string = "",
  statusFilter: string = "all",
  sortBy: VideoSortOption = "newest"
): VideoSummary[] {
  let result = [...videos];

  // 1. Status Filter
  if (statusFilter !== "all") {
    result = result.filter((v) => v.status === statusFilter);
  }

  // 2. Search Query Filter
  const q = searchQuery.trim().toLowerCase();
  if (q.length > 0) {
    result = result.filter(
      (v) =>
        v.topic.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }

  // 3. Sort
  result.sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (sortBy === "title") {
      return a.topic.localeCompare(b.topic);
    }
    return 0;
  });

  return result;
}
