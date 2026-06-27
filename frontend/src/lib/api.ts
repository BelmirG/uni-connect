// All paths are relative (e.g. "/api/auth/login").
// Next.js rewrites them to the backend — see next.config.js.
// credentials: "include" tells the browser to send the httpOnly cookie
// on every request, even though it can't read the cookie itself.

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: unknown };
    const { detail } = body;

    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { loc?: unknown[]; msg?: string };
      const field = Array.isArray(first.loc) ? String(first.loc.at(-1)) : "";
      message = field ? `${field}: ${first.msg ?? "invalid value"}` : (first.msg ?? "Validation error");
    } else {
      message = `Request failed (HTTP ${res.status})`;
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
