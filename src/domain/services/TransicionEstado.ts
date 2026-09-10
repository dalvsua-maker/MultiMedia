import type { EstadoContenido } from "@/domain/entities/Contenido";

export function isTransicionValida(
  _actual: EstadoContenido,
  _siguiente: EstadoContenido
): boolean {
  // Retroceso libre: cualquier estado válido → cualquier otro válido
  // Idempotente y cambios en cualquier dirección permitidos
  void _actual;
  void _siguiente;
  return true;
}

export function validarTransicion(
  _actual: EstadoContenido,
  _siguiente: EstadoContenido
): void {
  // No hay matriz restrictiva; la única validación es isEstadoValido (400)
  // Mantener función por compatibilidad, pero no lanza 409
  void _actual;
  void _siguiente;
}

export const ESTADOS_VALIDOS: readonly EstadoContenido[] = [
  "pendiente",
  "en_proceso",
  "visto",
] as const;

export function isEstadoValido(v: string): v is EstadoContenido {
  return (ESTADOS_VALIDOS as readonly string[]).includes(v);
}
