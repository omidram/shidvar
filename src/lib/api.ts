export type ApiError = { code: string; message: string; fields?: Record<string, string[]> };

export type ApiFailure = Error & { api?: ApiError };

export function getApiError(error: unknown): ApiError | undefined {
  if (error && typeof error === "object" && "api" in error) {
    return (error as ApiFailure).api;
  }
  return undefined;
}

export function formatApiError(error: unknown, fallback = "Request failed") {
  const apiError = getApiError(error);
  const fieldText = apiError?.fields
    ? Object.values(apiError.fields)
        .flat()
        .filter(Boolean)
        .join(" · ")
    : "";
  if (fieldText) return fieldText;
  if (apiError?.message) return apiError.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isAuthError(error: unknown) {
  return getApiError(error)?.code === "AUTH_REQUIRED";
}

export function liveInterval(ms: number) {
  return (query: { state: { status: string } }) => (query.state.status === "error" ? false : ms);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });
  } catch {
    const error = new Error("اتصال به سرور برقرار نشد") as ApiFailure;
    error.api = { code: "NETWORK_ERROR", message: "اتصال به سرور برقرار نشد" };
    throw error;
  }
  const json = (await res.json().catch(() => null)) as { success: boolean; data: T; error?: ApiError } | null;
  if (!res.ok || !json?.success) {
    const error = new Error(json?.error?.message ?? "Request failed") as ApiFailure;
    error.api = json?.error ?? { code: res.status === 401 ? "AUTH_REQUIRED" : "REQUEST_FAILED", message: json?.error?.message ?? "Request failed" };
    throw error;
  }
  return json.data;
}
