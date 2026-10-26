import { getToken, removeToken } from "./auth";
import type {
  User,
  UserCreate,
  Token,
  Channel,
  ChannelCreate,
  ChannelUpdate,
  VideoSummary,
  VideoDetail,
  VideoCreate,
  SubtitleData,
  ApiValidationError,
  ApiErrorResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  detail: string | ApiValidationError[];

  constructor(status: number, message: string, detail: string | ApiValidationError[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Format any API error into a friendly, readable string for users.
 * Handles 422 validation array of objects and 409 conflict messages nicely.
 */
export function formatErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") {
      if (err.status === 409) {
        if (err.detail.toLowerCase().includes("already running")) {
          return "A pipeline step is currently running. Please wait for it to finish.";
        }
        if (err.detail.toLowerCase().includes("already started")) {
          return "This video pipeline has already been started.";
        }
        if (err.detail.toLowerCase().includes("exists")) {
          return "An item with this name already exists on this platform.";
        }
        if (err.detail.toLowerCase().includes("done")) {
          return "All steps are already completed.";
        }
      }
      if (err.status === 401) {
        return "Invalid email or password.";
      }
      return err.detail;
    }

    if (Array.isArray(err.detail)) {
      return err.detail
        .map((d) => {
          const loc = d.loc ? d.loc.filter((l) => l !== "body").join(".") : "";
          return loc ? `${loc}: ${d.msg}` : d.msg;
        })
        .join("; ");
    }

    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "An unexpected error occurred.";
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);

  if (!skipAuth) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(path, {
    ...rest,
    headers,
  });

  if (response.status === 401 && !skipAuth && path !== "/api/auth/login") {
    removeToken();
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired. Please log in again.", "Unauthorized");
  }

  if (!response.ok) {
    let errorDetail: string | ApiValidationError[] = response.statusText;
    let message = `Request failed with status ${response.status}`;

    try {
      const errorJson = (await response.json()) as ApiErrorResponse;
      if (errorJson?.detail) {
        errorDetail = errorJson.detail;
        if (typeof errorDetail === "string") {
          message = errorDetail;
        } else if (Array.isArray(errorDetail)) {
          message = errorDetail.map((d) => d.msg).join(", ");
        }
      }
    } catch {
      // response wasn't JSON
    }

    throw new ApiError(response.status, message, errorDetail);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    async register(data: UserCreate): Promise<User> {
      return request<User>("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        skipAuth: true,
      });
    },

    async login(username: string, password: string): Promise<Token> {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      return request<Token>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        skipAuth: true,
      });
    },

    async me(): Promise<User> {
      return request<User>("/api/auth/me");
    },
  },

  channels: {
    async list(): Promise<Channel[]> {
      return request<Channel[]>("/api/channels");
    },

    async get(id: string): Promise<Channel> {
      return request<Channel>(`/api/channels/${id}`);
    },

    async create(data: ChannelCreate): Promise<Channel> {
      return request<Channel>("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    async update(id: string, data: ChannelUpdate): Promise<Channel> {
      return request<Channel>(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<void> {
      return request<void>(`/api/channels/${id}`, {
        method: "DELETE",
      });
    },
  },

  videos: {
    async listByChannel(channelId: string): Promise<VideoSummary[]> {
      return request<VideoSummary[]>(`/api/channels/${channelId}/videos`);
    },

    async create(channelId: string, data: VideoCreate): Promise<VideoSummary> {
      return request<VideoSummary>(`/api/channels/${channelId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },

    async get(id: string): Promise<VideoDetail> {
      return request<VideoDetail>(`/api/videos/${id}`);
    },

    async delete(id: string): Promise<void> {
      return request<void>(`/api/videos/${id}`, {
        method: "DELETE",
      });
    },

    async start(id: string): Promise<VideoDetail> {
      return request<VideoDetail>(`/api/videos/${id}/start`, {
        method: "POST",
      });
    },

    async next(id: string): Promise<VideoDetail> {
      return request<VideoDetail>(`/api/videos/${id}/next`, {
        method: "POST",
      });
    },

    async runAll(id: string): Promise<VideoDetail> {
      return request<VideoDetail>(`/api/videos/${id}/run-all`, {
        method: "POST",
      });
    },

    async rerunStep(id: string, stepName: string, prompt?: string): Promise<VideoDetail> {
      return request<VideoDetail>(`/api/videos/${id}/steps/${stepName}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt || null }),
      });
    },

    async downloadBlob(id: string, captioned: boolean = true): Promise<{ blob: Blob; filename: string }> {
      const token = getToken();
      const headers = new Headers();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`/api/videos/${id}/download?captioned=${captioned}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        let msg = `Download failed (${response.status})`;
        try {
          const err = await response.json();
          if (err.detail) msg = err.detail;
        } catch {
          // ignore non-json
        }
        throw new ApiError(response.status, msg, msg);
      }

      // Try reading filename from Content-Disposition header if available
      const disposition = response.headers.get("content-disposition");
      let filename = `video-${id}.mp4`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      return { blob, filename };
    },

    async getSceneImageBlob(videoId: string, sceneIndex: number): Promise<Blob> {
      const token = getToken();
      const headers = new Headers();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`/api/videos/${videoId}/images/${sceneIndex}`, {
        method: "GET",
        headers,
      });

      if (response.status === 401) {
        removeToken();
        if (typeof window !== "undefined") {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login";
        }
        throw new ApiError(401, "Session expired. Please log in again.", "Unauthorized");
      }

      if (!response.ok) {
        let msg = `Failed to load scene ${sceneIndex} image (${response.status})`;
        try {
          const err = await response.json();
          if (err.detail) msg = err.detail;
        } catch {
          // ignore non-json
        }
        throw new ApiError(response.status, msg, msg);
      }

      return response.blob();
    },

    async getSceneAudioBlob(videoId: string, sceneIndex: number): Promise<Blob> {
      const token = getToken();
      const headers = new Headers();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`/api/videos/${videoId}/audio/${sceneIndex}`, {
        method: "GET",
        headers,
      });

      if (response.status === 401) {
        removeToken();
        if (typeof window !== "undefined") {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login";
        }
        throw new ApiError(401, "Session expired. Please log in again.", "Unauthorized");
      }

      if (!response.ok) {
        let msg = `Failed to load scene ${sceneIndex} audio (${response.status})`;
        try {
          const err = await response.json();
          if (err.detail) msg = err.detail;
        } catch {
          // ignore non-json
        }
        throw new ApiError(response.status, msg, msg);
      }

      return response.blob();
    },

    async getVideoBlob(videoId: string, captioned: boolean = false): Promise<Blob> {
      const { blob } = await this.downloadBlob(videoId, captioned);
      return blob;
    },

    async getSubtitles(videoId: string): Promise<SubtitleData> {
      return request<SubtitleData>(`/api/videos/${videoId}/subtitles`);
    },
  },
};


