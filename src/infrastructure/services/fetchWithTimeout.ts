import { ExternalServiceError } from "@/application/errors/AppError";

export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
    return res;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new ExternalServiceError("Servicio externo no responde (timeout)");
    }
    throw new ExternalServiceError("Error al contactar servicio externo");
  } finally {
    clearTimeout(id);
  }
}

export function assertOk(res: Response, servicio: string): void {
  if (!res.ok) {
    throw new ExternalServiceError(
      `${servicio} respondió con ${res.status}`
    );
  }
}
