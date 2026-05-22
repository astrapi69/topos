/**
 * Topos API client.
 *
 * Phase 3 ships the request shell: ``ApiError``, ``request<T>()``,
 * and an empty ``api`` namespace. Phase 4 of the bootstrap adds
 * ``api.containers``, ``api.items``, ``api.categories``,
 * ``api.actions``. Phase 5 adds ``api.import.excel``.
 */

const BASE = "/api";

export class ApiError extends Error {
    status: number;
    detail: string;
    endpoint: string;
    method: string;
    stacktrace: string;
    timestamp: string;
    detailBody?: Record<string, unknown>;

    constructor(
        status: number,
        detail: string,
        endpoint: string,
        method: string,
        stacktrace = "",
        detailBody?: Record<string, unknown>,
    ) {
        super(detail);
        this.name = "ApiError";
        this.status = status;
        this.detail = detail;
        this.endpoint = endpoint;
        this.method = method;
        this.stacktrace = stacktrace;
        this.timestamp = new Date().toISOString();
        this.detailBody = detailBody;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    get isValidation(): boolean {
        return this.status === 400 || this.status === 422;
    }

    get isServerError(): boolean {
        return this.status >= 500;
    }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const method = options?.method || "GET";
    const endpoint = `${BASE}${path}`.split("?")[0];
    const res = await fetch(`${BASE}${path}`, {
        headers: {"Content-Type": "application/json"},
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({detail: res.statusText}));
        const isDictDetail = err.detail && typeof err.detail === "object";
        const detailString = isDictDetail
            ? (err.detail.message || err.detail.error || "Request failed")
            : (err.detail || "Request failed");
        throw new ApiError(
            res.status,
            detailString,
            endpoint,
            method,
            err.stacktrace || "",
            isDictDetail ? (err.detail as Record<string, unknown>) : undefined,
        );
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export interface AppConfig {
    app?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
    ui?: Record<string, unknown>;
    _secrets_managed_externally?: boolean;
}

export const api = {
    settings: {
        getApp: () => request<AppConfig>("/settings/app"),
    },
    health: () => request<{status: string; version: string; debug: boolean}>("/health"),
    i18n: {
        get: (lang: string) => request<Record<string, unknown>>(`/i18n/${lang}`),
    },
    // Phase 4: api.containers, api.items, api.categories, api.actions land here.
    // Phase 5: api.import.excel lands here.
};
