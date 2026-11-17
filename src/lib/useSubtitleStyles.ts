"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { SubtitleStyleOut } from "./types";

/**
 * Fetch and cache available subtitle styles from GET /videos/subtitle-styles.
 * Uses TanStack Query for server state management, caching, and loading/error states.
 */
export function useSubtitleStyles() {
  return useQuery<SubtitleStyleOut[]>({
    queryKey: ["subtitle-styles"],
    queryFn: () => api.videos.getSubtitleStyles(),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2,
  });
}
