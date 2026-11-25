"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { VisualStylesListOut } from "./types";

/**
 * Fetch and cache available visual style presets from GET /visual-styles.
 * Uses TanStack Query for server state management, caching, and loading/error states.
 */
export function useVisualStyles() {
  return useQuery<VisualStylesListOut>({
    queryKey: ["visual-styles"],
    queryFn: () => api.visualStyles.list(),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}
