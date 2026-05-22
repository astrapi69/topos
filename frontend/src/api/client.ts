/**
 * Topos API client.
 *
 * Wraps the FastAPI ``/api`` surface. The backend uses snake_case in
 * JSON; this module normalises to camelCase at the client boundary so
 * the rest of the frontend stays idiomatic TS.
 *
 * No external HTTP library: pure ``fetch``. ``ApiError`` lives here
 * too because it is the discriminated error type the rest of the UI
 * (notify.ts, toasts) checks via ``instanceof``.
 */

import type {
    ActionRow,
    ActionStatus,
    Category,
    CategoryNode,
    Container,
    ContainerType,
    ImportReport,
    Item,
    Owner,
    Priority,
} from "../types/topos";

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

// --- snake_case <-> camelCase ---

function snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
    return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-rename keys from snake_case to camelCase. Leaves Date strings,
 *  arrays of primitives, and nested object arrays alone otherwise. */
function camelizeKeys<T>(input: unknown): T {
    if (Array.isArray(input)) {
        return input.map((v) => camelizeKeys(v)) as unknown as T;
    }
    if (!isPlainObject(input)) {
        return input as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        out[snakeToCamel(k)] = camelizeKeys(v);
    }
    return out as T;
}

function snakeizeKeys(input: unknown): unknown {
    if (Array.isArray(input)) {
        return input.map((v) => snakeizeKeys(v));
    }
    if (!isPlainObject(input)) {
        return input;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        out[camelToSnake(k)] = snakeizeKeys(v);
    }
    return out;
}

// --- request helpers ---

interface RequestOptions {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method || "GET";
    let url = `${BASE}${path}`;
    if (options.query) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) {
            if (v === undefined || v === null) continue;
            params.append(camelToSnake(k), String(v));
        }
        const qs = params.toString();
        if (qs) url = `${url}?${qs}`;
    }
    const endpoint = url.split("?")[0];

    const init: RequestInit = {method};
    if (options.rawBody !== undefined) {
        init.body = options.rawBody;
    } else if (options.body !== undefined) {
        init.body = JSON.stringify(snakeizeKeys(options.body));
        init.headers = {"Content-Type": "application/json", ...(options.headers || {})};
    } else if (options.headers) {
        init.headers = options.headers;
    }

    const res = await fetch(url, init);
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
    const body = await res.json();
    return camelizeKeys<T>(body);
}

// --- typed payloads ---

export interface ContainerCreate {
    externalId: number;
    type: ContainerType;
    owner: Owner;
    label: string;
    description?: string | null;
    location?: string | null;
    sizeGroup?: string | null;
}

export interface ContainerUpdate {
    type?: ContainerType;
    owner?: Owner;
    label?: string;
    description?: string | null;
    location?: string | null;
    sizeGroup?: string | null;
}

export interface ItemCreate {
    containerId: number;
    content: string;
    priority?: Priority;
    categoryPath?: string | null;
    notes?: string | null;
}

export interface ItemUpdate {
    containerId?: number;
    content?: string;
    priority?: Priority;
    categoryPath?: string | null;
    notes?: string | null;
}

export interface CategoryCreate {
    path: string;
    parentPath?: string | null;
    name: string;
    displayName: string;
    level?: number;
}

export interface CategoryUpdate {
    name?: string;
    displayName?: string;
}

export interface ActionCreate {
    itemId: number;
    text: string;
    status?: ActionStatus;
    dueDate?: string | null;
}

export interface ActionUpdate {
    text?: string;
    status?: ActionStatus;
    dueDate?: string | null;
}

export interface AppConfig {
    app?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
    ui?: Record<string, unknown>;
}

export type SecretSourceKind =
    | "env"
    | "secrets_yaml"
    | "app_yaml"
    | "auto_generated";

export interface SecretSource {
    source: SecretSourceKind;
    path: string | null;
    envVar: string;
    secretsYamlPath: string;
}

// --- api namespace ---

export const api = {
    containers: {
        list: (filters: {owner?: Owner; type?: ContainerType} = {}) =>
            request<Container[]>("/containers", {query: filters}),
        get: (id: number) => request<Container>(`/containers/${id}`),
        getByExternalId: (externalId: number) =>
            request<Container>(`/containers/by-external-id/${externalId}`),
        create: (payload: ContainerCreate) =>
            request<Container>("/containers", {method: "POST", body: payload}),
        update: (id: number, payload: ContainerUpdate) =>
            request<Container>(`/containers/${id}`, {method: "PATCH", body: payload}),
        delete: (id: number) =>
            request<void>(`/containers/${id}`, {method: "DELETE"}),
    },
    items: {
        list: (filters: {containerId?: number} = {}) =>
            request<Item[]>("/items", {query: filters}),
        search: (q: string) => request<Item[]>("/items/search", {query: {q}}),
        get: (id: number) => request<Item>(`/items/${id}`),
        create: (payload: ItemCreate) =>
            request<Item>("/items", {method: "POST", body: payload}),
        update: (id: number, payload: ItemUpdate) =>
            request<Item>(`/items/${id}`, {method: "PATCH", body: payload}),
        delete: (id: number) => request<void>(`/items/${id}`, {method: "DELETE"}),
    },
    categories: {
        list: () => request<Category[]>("/categories"),
        tree: () => request<CategoryNode[]>("/categories/tree"),
        children: (parentPath: string | null = null) =>
            request<Category[]>("/categories/children", {
                query: parentPath !== null ? {parentPath} : {},
            }),
        get: (id: number) => request<Category>(`/categories/${id}`),
        create: (payload: CategoryCreate) =>
            request<Category>("/categories", {method: "POST", body: payload}),
        update: (id: number, payload: CategoryUpdate) =>
            request<Category>(`/categories/${id}`, {method: "PATCH", body: payload}),
        delete: (id: number) =>
            request<void>(`/categories/${id}`, {method: "DELETE"}),
    },
    actions: {
        list: (filters: {status?: ActionStatus} = {}) =>
            request<ActionRow[]>("/actions", {query: filters}),
        get: (id: number) => request<ActionRow>(`/actions/${id}`),
        create: (payload: ActionCreate) =>
            request<ActionRow>("/actions", {method: "POST", body: payload}),
        update: (id: number, payload: ActionUpdate) =>
            request<ActionRow>(`/actions/${id}`, {method: "PATCH", body: payload}),
        delete: (id: number) =>
            request<void>(`/actions/${id}`, {method: "DELETE"}),
        complete: (id: number) =>
            request<ActionRow>(`/actions/${id}/complete`, {method: "POST"}),
        reopen: (id: number) =>
            request<ActionRow>(`/actions/${id}/reopen`, {method: "POST"}),
    },
    importExcel: async (file: File, opts: {pruneMissing?: boolean} = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        const query = opts.pruneMissing ? "?prune_missing=true" : "";
        return request<ImportReport>(`/import/excel${query}`, {
            method: "POST",
            rawBody: fd,
        });
    },
    settings: {
        getApp: () => request<AppConfig>("/settings/app"),
        getSecretSource: () => request<SecretSource>("/settings/secret-source"),
    },
    health: () =>
        request<{status: string; version: string; debug: boolean}>("/health"),
    i18n: {
        get: (lang: string) => request<Record<string, unknown>>(`/i18n/${lang}`),
    },
};

// Expose helpers for tests that exercise the conversion logic directly.
export const _internal = {camelizeKeys, snakeizeKeys, snakeToCamel, camelToSnake};
