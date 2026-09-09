const TOKEN_KEY = "headshot_admin_token";
const API_KEY_STORAGE = "headshot_x_api_key";

export function apiBase() {
  return "/api-proxy";
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getApiKey() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function setApiKey(key: string) {
  if (!key) localStorage.removeItem(API_KEY_STORAGE);
  else localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, signal, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("content-type", "application/json");
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...rest,
      headers,
      credentials: "include",
      signal: controller.signal,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out. The API did not respond in time.", 408, "TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let payload = {} as T & { success?: boolean; error?: { code?: string; message?: string; details?: unknown } };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    throw new ApiError(`Request failed (${res.status})`, res.status);
  }
  if (!res.ok) {
    throw new ApiError(payload.error?.message ?? `Request failed (${res.status})`, res.status, payload.error?.code, payload.error?.details);
  }
  return payload;
}
