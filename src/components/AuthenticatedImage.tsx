"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Reference-counted registry for Object URLs created from Blobs.
 * Ensures that if multiple components (e.g. grid thumbnail + preview modal)
 * display the same image Blob, they share a single object URL.
 * When all components unmount, the URL is cleanly revoked.
 */
class ObjectUrlRegistry {
  private cache = new Map<Blob, { url: string; refCount: number }>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  acquire(blob: Blob): string {
    let entry = this.cache.get(blob);
    if (!entry) {
      entry = { url: URL.createObjectURL(blob), refCount: 0 };
      this.cache.set(blob, entry);
    }
    entry.refCount++;
    this.notify();
    return entry.url;
  }

  release(blob: Blob) {
    const entry = this.cache.get(blob);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      URL.revokeObjectURL(entry.url);
      this.cache.delete(blob);
    }
    this.notify();
  }

  getUrl(blob: Blob | undefined): string | null {
    if (!blob) return null;
    return this.cache.get(blob)?.url ?? null;
  }
}

const objectUrlRegistry = new ObjectUrlRegistry();

interface UseAuthenticatedImageOptions {
  videoId: string;
  sceneIndex: number;
  promptHash?: string;
  enabled?: boolean;
}

/**
 * Reusable hook to fetch a bearer-token authenticated scene image as a Blob,
 * convert it into a local object URL, and automatically revoke the URL when
 * the component unmounts or the blob changes.
 *
 * TanStack Query caches the Blob across multiple components (e.g. grid card + preview modal)
 * to prevent unnecessary re-downloads across the network.
 */
export function useAuthenticatedImage({
  videoId,
  sceneIndex,
  promptHash,
  enabled = true,
}: UseAuthenticatedImageOptions) {
  const query = useQuery({
    queryKey: ["scene-image", videoId, sceneIndex, promptHash],
    queryFn: () => api.videos.getSceneImageBlob(videoId, sceneIndex),
    enabled: Boolean(videoId && sceneIndex !== undefined && enabled),
    staleTime: 1000 * 60 * 60, // 1 hour (same hash is immutable)
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 1,
  });

  const blob = query.data;

  // Manage reference-counted object URL via external registry
  useEffect(() => {
    if (!blob) return;
    objectUrlRegistry.acquire(blob);
    return () => {
      objectUrlRegistry.release(blob);
    };
  }, [blob]);

  const imageUrl = useSyncExternalStore(
    objectUrlRegistry.subscribe,
    () => objectUrlRegistry.getUrl(blob),
    () => null
  );

  return {
    ...query,
    imageUrl,
    blob,
  };
}

interface AuthenticatedImageProps {
  videoId: string;
  sceneIndex: number;
  promptHash?: string;
  status?: string;
  hasFile?: boolean;
  alt: string;
  className?: string;
  imgClassName?: string;
  aspectRatio?: string;
  onClick?: () => void;
  errorMessage?: string | null;
}

function DisplayImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-500 animate-pulse">
          <span className="text-xs">Rendering...</span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        className={`${className} transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

export function AuthenticatedImage({
  videoId,
  sceneIndex,
  promptHash,
  status = "ok",
  hasFile = true,
  alt,
  className = "",
  imgClassName = "w-full h-full object-cover",
  aspectRatio = "aspect-[9/16]",
  onClick,
  errorMessage,
}: AuthenticatedImageProps) {
  const isOk = status === "ok" && hasFile;
  const isFailed = status === "failed";

  const { imageUrl, isLoading, isError, error, refetch } = useAuthenticatedImage({
    videoId,
    sceneIndex,
    promptHash,
    enabled: isOk,
  });

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 flex items-center justify-center select-none ${aspectRatio} ${className}`}
      onClick={imageUrl ? onClick : undefined}
    >
      {/* 1. Failed State from Generation */}
      {isFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-red-950/70 border border-red-800/80 text-red-200">
          <span className="text-xl mb-1.5">⚠️</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
            Generation Failed
          </span>
          <p className="text-[10px] text-red-400 mt-1 line-clamp-3">
            {errorMessage || "Image failed to generate."}
          </p>
        </div>
      )}

      {/* 2. Missing or Not Generated yet */}
      {!isFailed && !isOk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-800 text-slate-400">
          <span className="text-2xl mb-1 opacity-50">🖼️</span>
          <span className="text-[11px] font-medium text-slate-300">Image not ready</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Scene {sceneIndex}</span>
        </div>
      )}

      {/* 3. Loading / Fetching State */}
      {isOk && isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 animate-pulse">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mb-2" />
          <span className="text-[11px] font-medium text-slate-300">Loading scene {sceneIndex}...</span>
        </div>
      )}

      {/* 4. Network Fetch Error */}
      {isOk && !isLoading && isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900 border border-red-900/40 text-red-300">
          <span className="text-xl mb-1">✕</span>
          <span className="text-[11px] font-semibold">Failed to load</span>
          <p className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate">
            {error instanceof Error ? error.message : "Network error"}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refetch();
            }}
            className="mt-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. Successfully loaded image */}
      {isOk && imageUrl && (
        <DisplayImg
          key={imageUrl}
          src={imageUrl}
          alt={alt}
          className={imgClassName}
        />
      )}
    </div>
  );
}
