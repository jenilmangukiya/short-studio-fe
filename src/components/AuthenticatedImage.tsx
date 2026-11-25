"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { imageInvalidationRegistry } from "@/lib/visual-style-ui";
import { objectUrlRegistry, ObjectUrlRegistry } from "@/lib/object-url";

export { objectUrlRegistry, ObjectUrlRegistry };

export interface UseAuthenticatedImageOptions {
  videoId: string;
  sceneIndex: number;
  promptHash?: string;
  enabled?: boolean;
  retry?: number | boolean;
  isStale?: boolean;
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
  retry,
  isStale = false,
}: UseAuthenticatedImageOptions) {
  // Subscribe reactively to global visual-style image invalidation for this video
  const isRegistryStale = useSyncExternalStore(
    imageInvalidationRegistry.subscribe,
    () => (videoId ? imageInvalidationRegistry.isStale(videoId) : false),
    () => false
  );
  const invalidationVersion = useSyncExternalStore(
    imageInvalidationRegistry.subscribe,
    () => (videoId ? imageInvalidationRegistry.getVersion(videoId) : 0),
    () => 0
  );

  const effectiveIsStale = Boolean(isStale || isRegistryStale);

  const query = useQuery({
    queryKey: ["scene-image", videoId, sceneIndex, promptHash, invalidationVersion],
    queryFn: ({ signal }) => api.videos.getSceneImageBlob(videoId, sceneIndex, signal),
    enabled: Boolean(videoId && sceneIndex !== undefined && enabled && !effectiveIsStale),
    staleTime: 1000 * 60 * 60, // 1 hour (same hash is immutable)
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: retry ?? 1,
  });

  const blob = effectiveIsStale ? undefined : query.data;

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
    () => (effectiveIsStale ? null : objectUrlRegistry.getUrl(blob)),
    () => null
  );

  return {
    ...query,
    imageUrl,
    blob,
    isStale: effectiveIsStale,
  };
}

export interface AuthenticatedImageProps {
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
  isStale?: boolean;
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
  isStale = false,
}: AuthenticatedImageProps) {
  const { imageUrl, isLoading, isError, error, refetch, isStale: effectiveIsStale } =
    useAuthenticatedImage({
      videoId,
      sceneIndex,
      promptHash,
      enabled: status === "ok" && hasFile && !isStale,
      isStale,
    });

  const isOk = status === "ok" && hasFile && !effectiveIsStale;
  const isFailed = status === "failed" && !effectiveIsStale;

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 flex items-center justify-center select-none ${aspectRatio} ${className}`}
      onClick={!effectiveIsStale && imageUrl ? onClick : undefined}
    >
      {/* 1. Stale / Style Changed State */}
      {effectiveIsStale && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-900 border border-amber-500/30 text-amber-200 select-none">
          <span className="text-2xl mb-1.5 opacity-80">🎨</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            Style Changed
          </span>
          <p className="text-[10px] text-amber-200/80 mt-1 max-w-[130px] leading-tight">
            Image outdated. Ready for regeneration.
          </p>
        </div>
      )}

      {/* 2. Failed State from Generation */}
      {!effectiveIsStale && isFailed && (
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

      {/* 3. Missing or Not Generated yet */}
      {!effectiveIsStale && !isFailed && !isOk && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-800 text-slate-400">
          <span className="text-2xl mb-1 opacity-50">🖼️</span>
          <span className="text-[11px] font-medium text-slate-300">Image not ready</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Scene {sceneIndex}</span>
        </div>
      )}

      {/* 4. Loading / Fetching State */}
      {!effectiveIsStale && isOk && isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 animate-pulse">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mb-2" />
          <span className="text-[11px] font-medium text-slate-300">Loading scene {sceneIndex}...</span>
        </div>
      )}

      {/* 5. Network Fetch Error */}
      {!effectiveIsStale && isOk && !isLoading && isError && (
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

      {/* 6. Successfully loaded image */}
      {!effectiveIsStale && isOk && imageUrl && (
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
