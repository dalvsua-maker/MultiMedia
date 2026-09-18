// Deprecated: token now lives in httpOnly cookie, not localStorage
export function getToken(): string | null {
  return null;
}

export function setAuth(_token: string | null, usuario: unknown) {
  if (typeof window !== "undefined") {
    localStorage.setItem("usuario", JSON.stringify(usuario));
  }
}

export function setUsuario(usuario: unknown) {
  if (typeof window !== "undefined") {
    localStorage.setItem("usuario", JSON.stringify(usuario));
  }
}

export function clearAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
  }
}

export function getUsuario(): { id: string; nombre: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers as HeadersInit);
  if (!(init.body instanceof FormData)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  return res;
}
