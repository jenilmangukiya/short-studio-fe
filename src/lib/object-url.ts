"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Reference-counted registry for Object URLs created from Blobs.
 * Ensures that if multiple components display the same media Blob,
 * they share a single object URL. When all components unmount,
 * the URL is cleanly revoked to prevent memory leaks.
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

export const objectUrlRegistry = new ObjectUrlRegistry();

/**
 * Reusable hook that safely acquires an object URL for a given Blob
 * and automatically releases it via reference counting when the component
 * unmounts or the blob changes.
 */
export function useObjectUrl(blob: Blob | undefined): string | null {
  useEffect(() => {
    if (!blob) return;
    objectUrlRegistry.acquire(blob);
    return () => {
      objectUrlRegistry.release(blob);
    };
  }, [blob]);

  return useSyncExternalStore(
    objectUrlRegistry.subscribe,
    () => objectUrlRegistry.getUrl(blob),
    () => null
  );
}
