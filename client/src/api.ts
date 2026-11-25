export const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? "Request failed. Please try again.");
  return body.data as T;
}
export const post = <T = any>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });
export const patch = <T = any>(path: string, data: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) });
export const remove = <T = any>(path: string) => request<T>(path, { method: "DELETE" });
