type ApiResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { code: string; message: string } };

export async function api<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });

    const json = await res.json();

    if (json.error) {
      return { ok: false, data: null, error: json.error };
    }

    return { ok: true, data: json.data as T, error: null };
  } catch {
    return {
      ok: false,
      data: null,
      error: { code: "NETWORK_ERROR", message: "네트워크 오류가 발생했습니다" },
    };
  }
}
